# Backend/attendance/views.py

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, Avg
from django.utils import timezone
from datetime import datetime, timedelta, date
from collections import defaultdict

from .models import (
    AttendanceRecord,
    AttendanceSubmission,
    AttendanceSummary,
    SystemStatus,
    FlaggedAbsence,
)
from .serializers import (
    AttendanceRecordSerializer,
    BulkAttendanceSerializer,
    AttendanceSubmissionSerializer,
    SystemStatusSerializer,
    FlaggedAbsenceSerializer,
)
from students.models import Student, Class, Teacher
from students.serializers import StudentListSerializer, ClassSerializer

# Re-use the single source-of-truth school resolver
from students.views import get_user_school


# ==================== HELPERS ====================

def _school_base_qs(user):
    """
    Returns (school, Student base queryset, Class base queryset).
    All three are scoped to the user's school.
    If the school cannot be resolved every queryset is .none().
    """
    school = get_user_school(user)
    if school is None:
        return None, Student.objects.none(), Class.objects.none()
    return (
        school,
        Student.objects.filter(current_class__school=school),
        Class.objects.filter(school=school),
    )


def _school_scoped_class(user, class_id):
    """
    Fetch a Class by PK, restricted to the user's school.
    Returns (class_obj, None) on success or (None, error_response) on failure.
    """
    school = get_user_school(user)
    qs = Class.objects.filter(school=school) if school else Class.objects.none()
    try:
        return qs.get(pk=class_id), None
    except Class.DoesNotExist:
        return None, Response(
            {'success': False, 'error': 'Class not found'},
            status=status.HTTP_404_NOT_FOUND,
        )


# ==================== ATTENDANCE MARKING ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_attendance_form(request):
    """
    GET /api/attendance/take/
    Query params: ?class_id=1&date=2025-10-24
    """
    class_id = request.query_params.get('class_id')
    attendance_date = request.query_params.get('date', str(date.today()))

    if not class_id:
        return Response(
            {'success': False, 'error': 'class_id is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    class_obj, err = _school_scoped_class(request.user, class_id)
    if err:
        return err

    students = Student.objects.filter(
        current_class=class_obj, is_active=True
    ).order_by('first_name', 'last_name')

    existing_records = AttendanceRecord.objects.filter(
        class_session=class_obj, date=attendance_date
    ).select_related('student')

    attendance_dict = {r.student.id: r.status for r in existing_records}

    students_data = []
    present_count = absent_count = 0

    for student in students:
        att_status = attendance_dict.get(student.id)
        students_data.append({
            'id': student.id,
            'admission_number': student.admission_number,
            'full_name': student.full_name,
            'photo_url': student.photo.url if student.photo else None,
            'attendance_status': att_status,
        })
        if att_status == 'P':
            present_count += 1
        elif att_status == 'A':
            absent_count += 1

    total_students = students.count()

    return Response({
        'success': True,
        'data': {
            'class': {
                'id': class_obj.id,
                'name': class_obj.get_display_name(),
                'total_students': total_students,
            },
            'date': attendance_date,
            'students': students_data,
            'summary': {
                'total': total_students,
                'present': present_count,
                'absent': absent_count,
            },
        },
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_attendance(request):
    """
    POST /api/attendance/mark/
    Body: {
        "class_id": 1,
        "date": "2025-10-24",
        "attendance": [{"student_id": 1, "status": "P"}, ...],
        "marked_by": <teacher_pk>
    }
    """
    serializer = BulkAttendanceSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'success': False, 'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    class_id       = serializer.validated_data['class_id']
    attendance_date = serializer.validated_data['date']
    attendance_list = serializer.validated_data['attendance']
    marked_by_id   = serializer.validated_data.get('marked_by')

    # Scope the class to the user's school
    class_obj, err = _school_scoped_class(request.user, class_id)
    if err:
        return err

    marked_by = None
    if marked_by_id:
        try:
            # Also scope the teacher to the same school (via classes M2M)
            school = get_user_school(request.user)
            marked_by = Teacher.objects.filter(
                classes__school=school
            ).distinct().get(pk=marked_by_id)
        except Teacher.DoesNotExist:
            return Response(
                {'success': False, 'error': 'Teacher not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

    school = get_user_school(request.user)
    # Pre-fetch valid student IDs for this school to avoid cross-school injection
    valid_student_ids = set(
        Student.objects.filter(
            current_class__school=school, current_class=class_obj
        ).values_list('id', flat=True)
    )

    created_count = updated_count = 0
    present_count = absent_count = late_count = excused_count = 0

    for item in attendance_list:
        student_id     = int(item['student_id'])
        att_status     = item['status']

        # Silently skip students that don't belong to this school/class
        if student_id not in valid_student_ids:
            continue

        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            continue

        record, created = AttendanceRecord.objects.update_or_create(
            student=student,
            date=attendance_date,
            defaults={
                'class_session': class_obj,
                'status': att_status,
                'marked_by': marked_by,
            },
        )

        if created:
            created_count += 1
        else:
            updated_count += 1

        if att_status == 'P':
            present_count += 1
            FlaggedAbsence.objects.filter(
                student=student, is_resolved=False
            ).update(is_resolved=True)

        elif att_status == 'A':
            absent_count += 1
            total_records   = AttendanceRecord.objects.filter(student=student).count()
            present_records = AttendanceRecord.objects.filter(student=student, status='P').count()
            student_att_pct = round((present_records / total_records) * 100, 2) if total_records > 0 else 0.0

            FlaggedAbsence.objects.get_or_create(
                student=student,
                flagged_at=timezone.make_aware(
                    datetime.combine(attendance_date, datetime.min.time())
                ),
                defaults={
                    'is_resolved': False,
                    'attendance_percentage': student_att_pct,
                    'consecutive_absences': AttendanceRecord.objects.filter(
                        student=student, status='A'
                    ).count(),
                    'total_absences_this_month': AttendanceRecord.objects.filter(
                        student=student,
                        status='A',
                        date__month=attendance_date.month,
                        date__year=attendance_date.year,
                    ).count(),
                },
            )

        elif att_status == 'L':
            late_count += 1
        elif att_status == 'E':
            excused_count += 1

    total_students = len(attendance_list)

    if marked_by:
        AttendanceSubmission.objects.update_or_create(
            teacher=marked_by,
            class_session=class_obj,
            date=attendance_date,
            defaults={
                'total_students': total_students,
                'present_count': present_count,
                'absent_count': absent_count,
                'late_count': late_count,
                'excused_count': excused_count,
                'status': 'completed',
            },
        )

    return Response({
        'success': True,
        'message': f'Attendance saved. Created: {created_count}, Updated: {updated_count}',
        'summary': {
            'total': total_students,
            'present': present_count,
            'absent': absent_count,
            'late': late_count,
            'excused': excused_count,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def previous_attendance(request):
    """
    GET /api/attendance/previous/
    Query params: ?class_id=1&limit=10
    """
    class_id = request.query_params.get('class_id')
    limit    = int(request.query_params.get('limit', 10))

    if not class_id:
        return Response(
            {'success': False, 'error': 'class_id is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    class_obj, err = _school_scoped_class(request.user, class_id)
    if err:
        return err

    submissions = AttendanceSubmission.objects.filter(
        class_session=class_obj
    ).order_by('-date')[:limit]

    return Response({
        'success': True,
        'data': [
            {
                'date': sub.date,
                'present': sub.present_count,
                'absent': sub.absent_count,
                'total': sub.total_students,
                'percentage': sub.attendance_percentage,
            }
            for sub in submissions
        ],
    })


# ==================== DASHBOARD APIS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    """
    GET /api/dashboard/admin/
    All statistics are scoped to the requesting user's school.
    """
    school, student_qs, class_qs = _school_base_qs(request.user)

    if school is None:
        return Response(
            {'success': False, 'error': 'No school associated with this account'},
            status=status.HTTP_403_FORBIDDEN,
        )

    today = date.today()

    # ── Core counts ──────────────────────────────────────────────────────────
    total_students = student_qs.count()

    # Attendance records for students in this school only
    school_student_ids = student_qs.values_list('id', flat=True)

    todays_records  = AttendanceRecord.objects.filter(
        date=today, student_id__in=school_student_ids
    )
    total_marked    = todays_records.count()
    present_today   = todays_records.filter(status='P').count()
    absent_today    = todays_records.filter(status='A').count()

    todays_attendance_pct = (
        round((present_today / total_marked) * 100, 1) if total_marked > 0 else 0
    )

    active_classes = class_qs.filter(academic_year='2025-2026').count()

    # ── Weekly trend ─────────────────────────────────────────────────────────
    weekly_trend = []
    for i in range(6, -1, -1):
        day     = today - timedelta(days=i)
        records = AttendanceRecord.objects.filter(
            date=day, student_id__in=school_student_ids
        )
        total   = records.count()
        present = records.filter(status='P').count()
        weekly_trend.append({
            'day': day.strftime('%a').upper(),
            'date': day,
            'percentage': round((present / total) * 100, 1) if total > 0 else 0,
        })

    # ── Recent submissions (this school only) ────────────────────────────────
    school_class_ids = class_qs.values_list('id', flat=True)

    recent_submissions = (
        AttendanceSubmission.objects
        .filter(
            date__gte=today - timedelta(days=7),
            class_session_id__in=school_class_ids,
        )
        .select_related('teacher', 'class_session')
        .order_by('-submitted_at')[:10]
    )

    submissions_data = [
        {
            'teacher': sub.teacher.full_name,
            'class_name': sub.class_session.name,
            'submission_time': sub.submission_time,
            'present': sub.present_count,
            'total': sub.total_students,
            'status': sub.status,
        }
        for sub in recent_submissions
    ]

    # ── Staff performance (teachers in this school) ───────────────────────────
    teachers = Teacher.objects.filter(
        classes__school=school
    ).distinct().select_related()[:5]

    staff_performance = []
    for teacher in teachers:
        submissions_count = AttendanceSubmission.objects.filter(
            teacher=teacher,
            date__gte=today - timedelta(days=30),
            class_session_id__in=school_class_ids,
        ).count()

        main_class = teacher.get_main_class()
        staff_performance.append({
            'teacher': teacher.full_name,
            'grade': main_class.name if main_class else 'N/A',
            'submission_status': f'{submissions_count} submissions',
            'status': 'completed' if submissions_count > 20 else 'pending',
        })

    # ── Flagged absences (school-scoped via student) ──────────────────────────
    flagged_count = FlaggedAbsence.objects.filter(
        is_resolved=False,
        student_id__in=school_student_ids,
    ).count()

    return Response({
        'success': True,
        'data': {
            'school_name': school.name,
            'statistics': {
                'total_students': total_students,
                'students_change_percentage': 100,  # TODO: calculate real change
                'todays_attendance': {
                    'percentage': todays_attendance_pct,
                    'status': 'active' if todays_attendance_pct >= 90 else 'warning',
                },
                'active_classes': active_classes,
                'total_absentees_today': absent_today,
                'flagged_absences': flagged_count,
                'alert': absent_today > 20,
            },
            'weekly_attendance_trend': weekly_trend,
            'staff_performance': staff_performance,
            'recent_submissions': submissions_data,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teacher_dashboard(request):
    """
    GET /api/dashboard/teacher/

    Teacher is resolved from the authenticated session — no query param needed.
    Falls back to ?teacher_id= for backward compatibility (admin preview use).
    """
    user = request.user

    # Resolve teacher — from session or optional override param
    teacher_id_param = request.query_params.get('teacher_id')

    if teacher_id_param:
        # Only allow this shortcut if the user's school matches (prevents
        # peeking at teachers in other schools via param tampering)
        school = get_user_school(user)
        try:
            teacher = Teacher.objects.filter(
                classes__school=school
            ).distinct().get(pk=teacher_id_param)
        except Teacher.DoesNotExist:
            return Response(
                {'success': False, 'error': 'Teacher not found'},
                status=status.HTTP_404_NOT_FOUND,
            )
    else:
        try:
            teacher = user.teacher_profile
        except Exception:
            return Response(
                {'success': False, 'error': 'No teacher profile linked to this account'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    school = get_user_school(user)

    # Only return classes in this school
    assigned_classes = teacher.classes.filter(school=school)
    classes_data     = ClassSerializer(assigned_classes, many=True).data

    today        = date.today()
    todays_tasks = []

    for class_obj in assigned_classes:
        submission = AttendanceSubmission.objects.filter(
            teacher=teacher,
            class_session=class_obj,
            date=today,
        ).first()

        todays_tasks.append({
            'class': ClassSerializer(class_obj).data,
            'status': 'completed' if submission else 'pending',
        })

    # Quick personal stats
    school_student_ids = Student.objects.filter(
        current_class__school=school,
        current_class__in=assigned_classes,
    ).values_list('id', flat=True)

    todays_records  = AttendanceRecord.objects.filter(
        date=today, student_id__in=school_student_ids
    )
    total_marked    = todays_records.count()
    present_today   = todays_records.filter(status='P').count()

    return Response({
        'success': True,
        'data': {
            'teacher': {
                'id': teacher.id,
                'full_name': teacher.full_name,
                'employee_id': teacher.employee_id,
            },
            'school_name': school.name if school else None,
            'assigned_classes': classes_data,
            'todays_tasks': todays_tasks,
            'todays_summary': {
                'total_marked': total_marked,
                'present': present_today,
                'absent': total_marked - present_today,
                'attendance_pct': (
                    round((present_today / total_marked) * 100, 1) if total_marked > 0 else 0
                ),
            },
        },
    })


# ==================== REPORTS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_report(request):
    """
    GET /api/reports/attendance-summary/
    Query params: ?start_date=2025-10-01&end_date=2025-10-31&grade_level=all

    All data is scoped to the requesting user's school.
    """
    school, student_qs, class_qs = _school_base_qs(request.user)

    if school is None:
        return Response(
            {'success': False, 'error': 'No school associated with this account'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # ── Date range ────────────────────────────────────────────────────────────
    start_date_param = request.query_params.get('start_date')
    end_date_param   = request.query_params.get('end_date')
    grade_level      = request.query_params.get('grade_level', 'all')

    if start_date_param and end_date_param:
        start_date = datetime.strptime(start_date_param, '%Y-%m-%d').date()
        end_date   = datetime.strptime(end_date_param,   '%Y-%m-%d').date()
    else:
        end_date   = date.today()
        start_date = end_date - timedelta(days=30)

    # ── Base attendance queryset scoped to school ─────────────────────────────
    school_student_ids = student_qs.values_list('id', flat=True)
    school_class_ids   = class_qs.values_list('id', flat=True)

    records_query = AttendanceRecord.objects.filter(
        date__range=[start_date, end_date],
        student_id__in=school_student_ids,
    )

    if grade_level != 'all':
        records_query = records_query.filter(
            class_session__grade_level=grade_level
        )

    total_records   = records_query.count()
    present_records = records_query.filter(status='P').count()
    avg_attendance  = (
        round((present_records / total_records) * 100, 2) if total_records > 0 else 0
    )

    # ── Flagged absences (school-scoped) ──────────────────────────────────────
    flagged_count = FlaggedAbsence.objects.filter(
        is_resolved=False,
        student_id__in=school_student_ids,
    ).count()

    # ── Daily trend ───────────────────────────────────────────────────────────
    trends       = []
    current_date = start_date
    while current_date <= end_date:
        day_records = records_query.filter(date=current_date)
        day_total   = day_records.count()
        day_present = day_records.filter(status='P').count()
        trends.append({
            'date': current_date,
            'percentage': round((day_present / day_total) * 100, 1) if day_total > 0 else 0,
        })
        current_date += timedelta(days=1)

    # ── Attendance by grade (within school) ───────────────────────────────────
    grades = (
        class_qs.values_list('grade_level', flat=True).distinct().order_by('grade_level')
    )
    attendance_by_grade = []
    for grade in grades:
        grade_records = records_query.filter(class_session__grade_level=grade)
        grade_total   = grade_records.count()
        grade_present = grade_records.filter(status='P').count()
        grade_absent  = grade_records.filter(status='A').count()
        attendance_by_grade.append({
            'grade': f'Grade {grade}',
            'absences': grade_absent,
            'percentage': (
                round((grade_present / grade_total) * 100, 1) if grade_total > 0 else 0
            ),
        })

    # ── Classroom performance (school classes only) ───────────────────────────
    classroom_performance = []
    for class_obj in class_qs.select_related('class_teacher')[:20]:
        class_records = records_query.filter(class_session=class_obj)
        class_total   = class_records.count()
        class_present = class_records.filter(status='P').count()
        pct           = round((class_present / class_total) * 100, 1) if class_total > 0 else 0

        if pct >= 95:
            status_label = 'exemplary'
        elif pct >= 85:
            status_label = 'on_track'
        else:
            status_label = 'review_needed'

        classroom_performance.append({
            'classroom': class_obj.name,
            'teacher': class_obj.class_teacher.full_name if class_obj.class_teacher else 'N/A',
            'students': class_obj.student_count,
            'attendance_percentage': pct,
            'status': status_label,
        })

    return Response({
        'success': True,
        'data': {
            'school_name': school.name,
            'date_range': {'start': start_date, 'end': end_date},
            'total_students': student_qs.filter(status='active').count(),
            'avg_attendance': avg_attendance,
            'flagged_absences': flagged_count,
            'attendance_trends': trends,
            'attendance_by_grade': attendance_by_grade,
            'classroom_performance': classroom_performance,
        },
    })


# ==================== SYSTEM STATUS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_status(request):
    """GET /api/system/status/ — no school scoping needed"""
    status_obj = SystemStatus.get_current_status()

    if status_obj:
        return Response({
            'success': True,
            'data': SystemStatusSerializer(status_obj).data,
        })
    return Response({
        'success': True,
        'data': {'status': 'operational', 'message': 'All systems operational'},
    })