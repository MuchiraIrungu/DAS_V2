# Backend/attendance/views.py
# Attendance marking and dashboard views

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
    FlaggedAbsence
)
from .serializers import (
    AttendanceRecordSerializer,
    BulkAttendanceSerializer,
    AttendanceSubmissionSerializer,
    SystemStatusSerializer,
    FlaggedAbsenceSerializer
)
from students.models import Student, Class, Teacher
from students.serializers import StudentListSerializer, ClassSerializer


# ==================== ATTENDANCE MARKING ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_attendance_form(request):
    """
    GET /api/attendance/take/
    
    Get form data for taking attendance
    Query params: ?class_id=1&date=2023-10-24
    """
    class_id = request.query_params.get('class_id')
    attendance_date = request.query_params.get('date', str(date.today()))
    
    if not class_id:
        return Response(
            {
                'success': False,
                'error': 'class_id is required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        class_obj = Class.objects.get(pk=class_id)
    except Class.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Class not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get all students in the class
    students = Student.objects.filter(
        current_class=class_obj,
        is_active=True
    ).order_by('first_name', 'last_name')
    
    # Get existing attendance records for this date
    existing_records = AttendanceRecord.objects.filter(
        class_session=class_obj,
        date=attendance_date
    ).select_related('student')
    
    # Create a dict of student_id -> attendance_status
    attendance_dict = {
        record.student.id: record.status 
        for record in existing_records
    }
    
    # Build student list with attendance status
    students_data = []
    present_count = 0
    absent_count = 0
    
    for student in students:
        attendance_status = attendance_dict.get(student.id, None)
        
        students_data.append({
            'id': student.id,
            'admission_number': student.admission_number,
            'full_name': student.full_name,
            'photo_url': student.photo.url if student.photo else None,
            'attendance_status': attendance_status
        })
        
        if attendance_status == 'P':
            present_count += 1
        elif attendance_status == 'A':
            absent_count += 1
    
    total_students = students.count()
    
    return Response(
        {
            'success': True,
            'data': {
                'class': {
                    'id': class_obj.id,
                    'name': class_obj.get_display_name(),
                    'total_students': total_students
                },
                'date': attendance_date,
                'students': students_data,
                'summary': {
                    'total': total_students,
                    'present': present_count,
                    'absent': absent_count
                }
            }
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_attendance(request):
    """
    POST /api/attendance/mark/
    
    Mark attendance for multiple students
    Body: {
        "class_id": 1,
        "date": "2023-10-24",
        "attendance": [
            {"student_id": 1, "status": "P"},
            {"student_id": 2, "status": "A"},
            ...
        ]
    }
    """
    serializer = BulkAttendanceSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(
            {
                'success': False,
                'error': 'Validation failed',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    class_id = serializer.validated_data['class_id']
    attendance_date = serializer.validated_data['date']
    attendance_list = serializer.validated_data['attendance']
    marked_by_id = serializer.validated_data.get('marked_by')
    
    try:
        class_obj = Class.objects.get(pk=class_id)
        marked_by = Teacher.objects.get(pk=marked_by_id) if marked_by_id else None
    except (Class.DoesNotExist, Teacher.DoesNotExist) as e:
        return Response(
            {
                'success': False,
                'error': str(e)
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Create or update attendance records
    created_count = 0
    updated_count = 0
    present_count = 0
    absent_count = 0
    late_count = 0
    excused_count = 0
    
    for item in attendance_list:
        student_id = item['student_id']
        attendance_status = item['status']
        
        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            continue
        
        # Create or update record
        record, created = AttendanceRecord.objects.update_or_create(
            student=student,
            date=attendance_date,
            defaults={
                'class_session': class_obj,
                'status': attendance_status,
                'marked_by': marked_by
            }
        )
        
        if created:
            created_count += 1
        else:
            updated_count += 1
        
        # Count statuses
        if attendance_status == 'P':
            present_count += 1
        elif attendance_status == 'A':
            absent_count += 1
        elif attendance_status == 'L':
            late_count += 1
        elif attendance_status == 'E':
            excused_count += 1
    
    total_students = len(attendance_list)
    
    # Create or update submission record
    if marked_by:
        submission, _ = AttendanceSubmission.objects.update_or_create(
            teacher=marked_by,
            class_session=class_obj,
            date=attendance_date,
            defaults={
                'total_students': total_students,
                'present_count': present_count,
                'absent_count': absent_count,
                'late_count': late_count,
                'excused_count': excused_count,
                'status': 'completed'
            }
        )
    
    return Response(
        {
            'success': True,
            'message': f'Attendance saved successfully. Created: {created_count}, Updated: {updated_count}',
            'summary': {
                'total': total_students,
                'present': present_count,
                'absent': absent_count,
                'late': late_count,
                'excused': excused_count
            }
        },
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def previous_attendance(request):
    """
    GET /api/attendance/previous/
    
    Get previous attendance records for a class
    Query params: ?class_id=1&limit=10
    """
    class_id = request.query_params.get('class_id')
    limit = int(request.query_params.get('limit', 10))
    
    if not class_id:
        return Response(
            {
                'success': False,
                'error': 'class_id is required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        class_obj = Class.objects.get(pk=class_id)
    except Class.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Class not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get unique dates when attendance was taken
    submissions = AttendanceSubmission.objects.filter(
        class_session=class_obj
    ).order_by('-date')[:limit]
    
    previous_records = []
    for submission in submissions:
        previous_records.append({
            'date': submission.date,
            'present': submission.present_count,
            'absent': submission.absent_count,
            'total': submission.total_students,
            'percentage': submission.attendance_percentage
        })
    
    return Response(
        {
            'success': True,
            'data': previous_records
        },
        status=status.HTTP_200_OK
    )


# ==================== DASHBOARD APIS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    """
    GET /api/dashboard/admin/
    
    Get admin dashboard statistics and data
    """
    today = date.today()
    
    # Total students
    total_students = Student.objects.all().count()
    
    # Today's attendance
    todays_records = AttendanceRecord.objects.filter(date=today)
    total_marked = todays_records.count()
    present_today = todays_records.filter(status='P').count()
    absent_today = todays_records.filter(status='A').count()
    
    if total_marked > 0:
        todays_attendance_percentage = round((present_today / total_marked) * 100, 1)
    else:
        todays_attendance_percentage = 0
    
    # Active classes
    active_classes = Class.objects.filter(
        academic_year='2025-2026'  # TODO: Make this dynamic
    ).count()
    
    # Weekly attendance trend (last 7 days)
    weekly_trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        records = AttendanceRecord.objects.filter(date=day)
        total = records.count()
        present = records.filter(status='P').count()
        
        percentage = round((present / total) * 100, 1) if total > 0 else 0
        
        weekly_trend.append({
            'day': day.strftime('%a').upper(),
            'date': day,
            'percentage': percentage
        })
    
    # Staff performance (recent submissions)
    recent_submissions = AttendanceSubmission.objects.filter(
        date__gte=today - timedelta(days=7)
    ).select_related('teacher', 'class_session').order_by('-submitted_at')[:10]
    
    submissions_data = []
    for sub in recent_submissions:
        submissions_data.append({
            'teacher': sub.teacher.full_name,
            'class_name': sub.class_session.name,
            'submission_time': sub.submission_time,
            'present': sub.present_count,
            'total': sub.total_students,
            'status': sub.status
        })
    
    # Staff performance summary
    staff_performance = []
    teachers = Teacher.objects.filter(is_active=True)[:5]
    for teacher in teachers:
        submissions_count = AttendanceSubmission.objects.filter(
            teacher=teacher,
            date__gte=today - timedelta(days=30)
        ).count()
        
        main_class = teacher.get_main_class()
        
        staff_performance.append({
            'teacher': teacher.full_name,
            'grade': main_class.name if main_class else 'N/A',
            'submission_status': f'{submissions_count} submissions',
            'status': 'completed' if submissions_count > 20 else 'pending'
        })
    
    return Response(
        {
            'success': True,
            'data': {
                'school_name': 'Maplewood Primary School',  # TODO: Get from settings
                'statistics': {
                    'total_students': total_students,
                    'students_change_percentage': 100,  # TODO: Calculate actual change
                    'todays_attendance': {
                        'percentage': todays_attendance_percentage,
                        'status': 'active' if todays_attendance_percentage >= 90 else 'warning'
                    },
                    'active_classes': active_classes,
                    'total_absentees_today': absent_today,
                    'alert': absent_today > 20
                },
                'weekly_attendance_trend': weekly_trend,
                'staff_performance': staff_performance,
                'recent_submissions': submissions_data
            }
        },
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teacher_dashboard(request):
    """
    GET /api/dashboard/teacher/
    
    Get teacher dashboard data
    """
    # TODO: Get teacher from authenticated user
    teacher_id = request.query_params.get('teacher_id')
    
    if not teacher_id:
        return Response(
            {
                'success': False,
                'error': 'teacher_id is required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        teacher = Teacher.objects.get(pk=teacher_id)
    except Teacher.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Teacher not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get assigned classes
    assigned_classes = teacher.classes.all()
    classes_data = ClassSerializer(assigned_classes, many=True).data
    
    # Get today's tasks (classes that need attendance)
    today = date.today()
    todays_tasks = []
    
    for class_obj in assigned_classes:
        submission = AttendanceSubmission.objects.filter(
            teacher=teacher,
            class_session=class_obj,
            date=today
        ).first()
        
        todays_tasks.append({
            'class': ClassSerializer(class_obj).data,
            'status': 'completed' if submission else 'pending'
        })
    
    return Response(
        {
            'success': True,
            'data': {
                'assigned_classes': classes_data,
                'todays_tasks': todays_tasks
            }
        },
        status=status.HTTP_200_OK
    )


# ==================== REPORTS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_report(request):
    """
    GET /api/reports/attendance-summary/
    
    Get attendance report with statistics
    Query params: ?start_date=2023-10-01&end_date=2023-10-31&grade_level=all
    """
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    grade_level = request.query_params.get('grade_level', 'all')
    
    if not start_date or not end_date:
        # Default to last 30 days
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
    else:
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
    
    # Get all attendance records in date range
    records_query = AttendanceRecord.objects.filter(
        date__range=[start_date, end_date]
    )
    
    if grade_level != 'all':
        records_query = records_query.filter(
            class_session__grade_level=grade_level
        )
    
    total_records = records_query.count()
    present_records = records_query.filter(status='P').count()
    
    avg_attendance = round((present_records / total_records) * 100, 2) if total_records > 0 else 0
    
    # Flagged absences
    flagged_count = FlaggedAbsence.objects.filter(is_resolved=False).count()
    
    # Attendance trends (daily average)
    trends = []
    current_date = start_date
    while current_date <= end_date:
        day_records = records_query.filter(date=current_date)
        day_total = day_records.count()
        day_present = day_records.filter(status='P').count()
        
        percentage = round((day_present / day_total) * 100, 1) if day_total > 0 else 0
        
        trends.append({
            'date': current_date,
            'percentage': percentage
        })
        
        current_date += timedelta(days=1)
    
    # Attendance by grade
    attendance_by_grade = []
    grades = Class.objects.values_list('grade_level', flat=True).distinct()
    
    for grade in grades:
        grade_records = records_query.filter(class_session__grade_level=grade)
        grade_absent = grade_records.filter(status='A').count()
        
        attendance_by_grade.append({
            'grade': f'Grade {grade}',
            'absences': grade_absent,
            'percentage': 25  # Mock percentage
        })
    
    # Classroom performance
    classroom_performance = []
    classes = Class.objects.all()[:10]
    
    for class_obj in classes:
        class_records = records_query.filter(class_session=class_obj)
        class_total = class_records.count()
        class_present = class_records.filter(status='P').count()
        
        percentage = round((class_present / class_total) * 100, 1) if class_total > 0 else 0
        
        # Determine status
        if percentage >= 95:
            status_label = 'exemplary'
        elif percentage >= 85:
            status_label = 'on_track'
        else:
            status_label = 'review_needed'
        
        classroom_performance.append({
            'classroom': class_obj.name,
            'teacher': class_obj.class_teacher.full_name if class_obj.class_teacher else 'N/A',
            'students': class_obj.student_count,
            'attendance_percentage': percentage,
            'status': status_label
        })
    
    return Response(
        {
            'success': True,
            'data': {
                'total_students': Student.objects.filter(is_active=True).count(),
                'avg_attendance': avg_attendance,
                'flagged_absences': flagged_count,
                'attendance_trends': trends,
                'attendance_by_grade': attendance_by_grade,
                'classroom_performance': classroom_performance
            }
        },
        status=status.HTTP_200_OK
    )


# ==================== SYSTEM STATUS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_status(request):
    """
    GET /api/system/status/
    
    Get current system status
    """
    status_obj = SystemStatus.get_current_status()
    
    if status_obj:
        serializer = SystemStatusSerializer(status_obj)
        return Response(
            {
                'success': True,
                'data': serializer.data
            },
            status=status.HTTP_200_OK
        )
    else:
        # Default status
        return Response(
            {
                'success': True,
                'data': {
                    'status': 'operational',
                    'message': 'All systems operational'
                }
            },
            status=status.HTTP_200_OK
        )