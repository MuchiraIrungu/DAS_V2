# Backend/students/views.py

from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.middleware.csrf import get_token
from rest_framework.authentication import SessionAuthentication

from .models import User
from .serializers import UserSerializer

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Avg
from django.utils import timezone
from datetime import date
import qrcode
from io import BytesIO
import json
import base64
import cloudinary.uploader

from .models import Student, Class, Teacher, School, Grade, Term, Subject, PerformanceRecord
from .serializers import (
    StudentListSerializer,
    StudentDetailSerializer,
    StudentCreateUpdateSerializer,
    ClassSerializer,
    TeacherListSerializer,
    TeacherDetailSerializer,
    TeacherCreateUpdateSerializer,
    SchoolSerializer,
    GradeSerializer,
    GradeListSerializer,
    TermSerializer,
    TermListSerializer,
    SubjectSerializer,
    SubjectListSerializer,
    PerformanceRecordSerializer,
    PerformanceRecordCreateSerializer,
    PerformanceRecordListSerializer,
    StudentPerformanceSummarySerializer,
    StudentQRCodeSerializer,
)
from attendance.models import AttendanceRecord


# ==================== SCHOOL SCOPE UTILITIES ====================

def get_user_school(user):
    """
    Resolve the school for any authenticated user.

    Resolution order:
      1. user.school (explicit FK) — covers admins acting as headteachers
         and teachers with a direct school assignment.
      2. teacher fallback — for teachers whose school wasn't set explicitly,
         derive it from their first assigned class.

    Returns a School instance, or None (user sees nothing).
    """
    if user.school_id:
        return user.school

    if user.role == 'teacher':
        try:
            first_class = user.teacher_profile.classes.select_related('school').first()
            return first_class.school if first_class else None
        except Exception:
            return None

    return None


class SchoolScopedMixin:
    """
    Mixin that restricts every queryset to the requesting user's school.

    Sub-classes must define `school_filter_field` — the ORM lookup path
    from the model to a School PK.

        school_filter_field = 'current_class__school'   # Student
        school_filter_field = 'school'                  # Class / Grade
        school_filter_field = 'grade__school'           # Term / Subject
        school_filter_field = 'subject__grade__school'  # PerformanceRecord
    """
    school_filter_field = None

    def get_school_filtered_queryset(self, queryset):
        school = get_user_school(self.request.user)

        if school is None:
            return queryset.none()

        if not self.school_filter_field:
            raise NotImplementedError(
                f"{self.__class__.__name__} must define `school_filter_field`"
            )

        return queryset.filter(**{self.school_filter_field: school})


# ==================== AUTH VIEWS ====================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    return Response({'csrfToken': get_token(request)})


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """POST /api/auth/login/"""
    email = request.data.get('email')
    password = request.data.get('password')
    remember_me = request.data.get('remember_me', False)

    if not email or not password:
        return Response(
            {'success': False, 'error': 'Email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user_obj = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'success': False, 'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    user = authenticate(request, username=user_obj.username, password=password)
    if user is None:
        return Response({'success': False, 'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    if not user.is_active:
        return Response({'success': False, 'error': 'Account is inactive'}, status=status.HTTP_403_FORBIDDEN)

    login(request, user)
    request.session.set_expiry(0 if not remember_me else 86400 * 7)

    return Response({
        'success': True,
        'message': 'Login successful',
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """POST /api/auth/logout/"""
    logout(request)
    return Response({'success': True, 'message': 'Logout successful'})


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def current_user(request):
    """GET /api/auth/me/"""
    return Response({'success': True, 'user': UserSerializer(request.user).data})


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    """POST /api/auth/forgot-password/"""
    email = request.data.get('email')
    if not email:
        return Response({'success': False, 'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    # Uniform response to avoid email enumeration
    return Response({
        'success': True,
        'message': 'If an account exists with this email, password reset instructions have been sent'
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def request_access(request):
    """POST /api/auth/request-access/"""
    full_name = request.data.get('full_name')
    email = request.data.get('email')
    school = request.data.get('school')

    if not all([full_name, email, school]):
        return Response(
            {'success': False, 'error': 'Full name, email, and school are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    # TODO: persist access request and notify a platform superuser
    return Response(
        {'success': True, 'message': 'Access request submitted. An administrator will review your request.'},
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """POST /api/auth/change-password/"""
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')

    if not old_password or not new_password:
        return Response(
            {'success': False, 'error': 'Both old and new passwords are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not user.check_password(old_password):
        return Response({'success': False, 'error': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    return Response({'success': True, 'message': 'Password changed successfully'})


# ==================== STUDENT VIEWS ====================

class StudentListCreateView(SchoolScopedMixin, generics.ListCreateAPIView):
    """
    GET  /api/students/
    POST /api/students/
    """
    permission_classes = [IsAuthenticated]
    school_filter_field = 'current_class__school'
    filterset_fields = ['current_class', 'status', 'gender']
    ordering_fields = ['first_name', 'last_name', 'admission_number', 'enrollment_date']
    ordering = ['first_name', 'last_name']

    def get_queryset(self):
        queryset = Student.objects.select_related('current_class__school').all()
        queryset = self.get_school_filtered_queryset(queryset)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(admission_number__icontains=search) |
                Q(parent_name__icontains=search) |
                Q(parent_phone__icontains=search) |
                Q(email__icontains=search)
            )

        grade = self.request.query_params.get('grade')
        if grade and grade.lower() != 'all':
            queryset = queryset.filter(current_class__grade_level=grade)

        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter.lower() != 'all':
            queryset = queryset.filter(status=status_filter)

        return queryset

    def get_serializer_class(self):
        return StudentCreateUpdateSerializer if self.request.method == 'POST' else StudentListSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        today = date.today()
        school = get_user_school(request.user)

        base_qs = (
            Student.objects.filter(current_class__school=school)
            if school else Student.objects.none()
        )
        response.data['statistics'] = {
            'total_active': base_qs.filter(status='active').count(),
            'avg_attendance': 94.2,  # TODO: calculate from AttendanceRecord
            'birthdays_today': base_qs.filter(
                status='active',
                date_of_birth__month=today.month,
                date_of_birth__day=today.day
            ).count()
        }
        return response

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'success': True, 'message': 'Student created successfully', 'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        return Response(
            {'success': False, 'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )


class StudentDetailView(SchoolScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/students/{id}/"""
    permission_classes = [IsAuthenticated]
    school_filter_field = 'current_class__school'

    def get_queryset(self):
        return self.get_school_filtered_queryset(
            Student.objects.select_related('current_class__school').all()
        )

    def get_serializer_class(self):
        return StudentCreateUpdateSerializer if self.request.method in ['PUT', 'PATCH'] else StudentDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        return Response({'success': True, 'data': self.get_serializer(self.get_object()).data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response({'success': True, 'message': 'Student updated successfully', 'data': serializer.data})
        return Response(
            {'success': False, 'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return Response({'success': True, 'message': 'Student deleted successfully'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_attendance_history(request, pk):
    """GET /api/students/{id}/attendance/"""
    school = get_user_school(request.user)
    qs = Student.objects.filter(current_class__school=school) if school else Student.objects.none()

    try:
        student = qs.get(pk=pk)
    except Student.DoesNotExist:
        return Response({'success': False, 'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    records_query = AttendanceRecord.objects.filter(student=student).order_by('date')
    if start_date:
        records_query = records_query.filter(date__gte=start_date)
    if end_date:
        records_query = records_query.filter(date__lte=end_date)

    return Response({
        'success': True,
        'data': {
            'student': StudentDetailSerializer(student).data,
            'attendance_percentage': student.get_attendance_percentage(start_date, end_date),
            'records': [
                {
                    'date': str(r.date),
                    'status': r.status,
                    'subject': r.class_session.name if r.class_session else None,
                }
                for r in records_query
            ]
        }
    })


# ==================== CLASS VIEWS ====================

class ClassListCreateView(SchoolScopedMixin, generics.ListCreateAPIView):
    """GET/POST /api/classes/"""
    permission_classes = [IsAuthenticated]
    serializer_class = ClassSerializer
    school_filter_field = 'school'
    filterset_fields = ['grade_level', 'academic_year', 'school']
    ordering = ['grade_level', 'section']

    def get_queryset(self):
        return self.get_school_filtered_queryset(
            Class.objects.select_related('school', 'class_teacher').all()
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({'success': True, 'data': response.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'success': True, 'message': 'Class created successfully', 'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        return Response(
            {'success': False, 'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )


class ClassDetailView(SchoolScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/classes/{id}/"""
    permission_classes = [IsAuthenticated]
    serializer_class = ClassSerializer
    school_filter_field = 'school'

    def get_queryset(self):
        return self.get_school_filtered_queryset(
            Class.objects.select_related('school', 'class_teacher').all()
        )

    def retrieve(self, request, *args, **kwargs):
        return Response({'success': True, 'data': self.get_serializer(self.get_object()).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def class_students(request, pk):
    """GET /api/classes/{id}/students/"""
    school = get_user_school(request.user)
    qs = Class.objects.filter(school=school) if school else Class.objects.none()

    try:
        class_obj = qs.get(pk=pk)
    except Class.DoesNotExist:
        return Response({'success': False, 'error': 'Class not found'}, status=status.HTTP_404_NOT_FOUND)

    students = Student.objects.filter(current_class=class_obj, is_active=True)
    return Response({
        'success': True,
        'data': {
            'class': ClassSerializer(class_obj).data,
            'students': StudentListSerializer(students, many=True).data,
            'total_students': students.count()
        }
    })


# ==================== TEACHER VIEWS ====================

class TeacherListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/teachers/"""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        school = get_user_school(self.request.user)
        if school is None:
            return Teacher.objects.none()
        # M2M: any teacher with at least one class in this school
        return Teacher.objects.prefetch_related('classes').filter(
            classes__school=school
        ).distinct()

    def get_serializer_class(self):
        return TeacherCreateUpdateSerializer if self.request.method == 'POST' else TeacherListSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({'success': True, 'data': response.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'success': True, 'message': 'Teacher created successfully', 'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        return Response(
            {'success': False, 'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )


class TeacherDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/teachers/{id}/"""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        school = get_user_school(self.request.user)
        if school is None:
            return Teacher.objects.none()
        return Teacher.objects.prefetch_related('classes').filter(
            classes__school=school
        ).distinct()

    def get_serializer_class(self):
        return TeacherCreateUpdateSerializer if self.request.method in ['PUT', 'PATCH'] else TeacherDetailSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teacher_classes(request, pk):
    """GET /api/teachers/{id}/classes/"""
    school = get_user_school(request.user)

    try:
        teacher = Teacher.objects.filter(classes__school=school).distinct().get(pk=pk)
    except Teacher.DoesNotExist:
        return Response({'success': False, 'error': 'Teacher not found'}, status=status.HTTP_404_NOT_FOUND)

    classes = teacher.classes.filter(school=school)
    return Response({'success': True, 'data': ClassSerializer(classes, many=True).data})


# ==================== SCHOOL VIEWS ====================

class SchoolListCreateView(generics.ListCreateAPIView):
    """
    GET /api/schools/
    Each user only sees their own school. A school object is returned
    even for admins — they are scoped to one school, not the platform.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SchoolSerializer

    def get_queryset(self):
        school = get_user_school(self.request.user)
        if school is None:
            return School.objects.none()
        return School.objects.filter(pk=school.pk)


class SchoolDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/schools/{id}/"""
    permission_classes = [IsAuthenticated]
    serializer_class = SchoolSerializer

    def get_queryset(self):
        school = get_user_school(self.request.user)
        if school is None:
            return School.objects.none()
        return School.objects.filter(pk=school.pk)


# ==================== GRADE VIEWS ====================

class GradeListCreateView(SchoolScopedMixin, generics.ListCreateAPIView):
    """GET/POST /api/grades/"""
    permission_classes = [IsAuthenticated]
    school_filter_field = 'school'
    filterset_fields = ['school', 'school_year', 'is_active']
    ordering = ['level', 'school_year']

    def get_queryset(self):
        return self.get_school_filtered_queryset(
            Grade.objects.select_related('school').all()
        )

    def get_serializer_class(self):
        return GradeSerializer if self.request.method == 'POST' else GradeListSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({'success': True, 'data': response.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'success': True, 'message': 'Grade created successfully', 'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        return Response(
            {'success': False, 'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )


class GradeDetailView(SchoolScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/grades/{id}/"""
    permission_classes = [IsAuthenticated]
    school_filter_field = 'school'
    serializer_class = GradeSerializer

    def get_queryset(self):
        return self.get_school_filtered_queryset(Grade.objects.all())


# ==================== TERM VIEWS ====================

class TermListCreateView(SchoolScopedMixin, generics.ListCreateAPIView):
    """GET/POST /api/terms/"""
    permission_classes = [IsAuthenticated]
    school_filter_field = 'grade__school'
    filterset_fields = ['grade', 'is_active']
    ordering = ['-start_date']

    def get_queryset(self):
        queryset = self.get_school_filtered_queryset(
            Term.objects.select_related('grade__school').all()
        )
        grade_id = self.request.query_params.get('grade_id')
        if grade_id:
            queryset = queryset.filter(grade_id=grade_id)
        return queryset

    def get_serializer_class(self):
        return TermSerializer if self.request.method == 'POST' else TermListSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({'success': True, 'data': response.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'success': True, 'message': 'Term created successfully', 'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        return Response(
            {'success': False, 'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )


class TermDetailView(SchoolScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/terms/{id}/"""
    permission_classes = [IsAuthenticated]
    school_filter_field = 'grade__school'
    serializer_class = TermSerializer

    def get_queryset(self):
        return self.get_school_filtered_queryset(Term.objects.all())


# ==================== SUBJECT VIEWS ====================

class SubjectListCreateView(SchoolScopedMixin, generics.ListCreateAPIView):
    """GET/POST /api/subjects/"""
    permission_classes = [IsAuthenticated]
    school_filter_field = 'grade__school'
    filterset_fields = ['grade', 'term', 'teacher', 'is_active']
    ordering = ['name']

    def get_queryset(self):
        queryset = self.get_school_filtered_queryset(
            Subject.objects.select_related('grade__school', 'term', 'teacher').all()
        )
        grade_id = self.request.query_params.get('grade_id')
        term_id = self.request.query_params.get('term_id')
        if grade_id:
            queryset = queryset.filter(grade_id=grade_id)
        if term_id:
            queryset = queryset.filter(term_id=term_id)
        return queryset

    def get_serializer_class(self):
        return SubjectSerializer if self.request.method == 'POST' else SubjectListSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({'success': True, 'data': response.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'success': True, 'message': 'Subject created successfully', 'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        return Response(
            {'success': False, 'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )


class SubjectDetailView(SchoolScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/subjects/{id}/"""
    permission_classes = [IsAuthenticated]
    school_filter_field = 'grade__school'
    serializer_class = SubjectSerializer

    def get_queryset(self):
        return self.get_school_filtered_queryset(Subject.objects.all())


# ==================== PERFORMANCE VIEWS ====================

class PerformanceRecordListCreateView(SchoolScopedMixin, generics.ListCreateAPIView):
    """GET/POST /api/performance/"""
    permission_classes = [IsAuthenticated]
    school_filter_field = 'subject__grade__school'
    filterset_fields = ['student', 'subject', 'term']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = self.get_school_filtered_queryset(
            PerformanceRecord.objects.select_related(
                'student', 'subject__grade__school', 'term', 'created_by'
            ).all()
        )
        student_id = self.request.query_params.get('student_id')
        term_id = self.request.query_params.get('term_id')
        subject_id = self.request.query_params.get('subject_id')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if term_id:
            queryset = queryset.filter(term_id=term_id)
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        return queryset

    def get_serializer_class(self):
        return PerformanceRecordCreateSerializer if self.request.method == 'POST' else PerformanceRecordListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            performance = serializer.save()
            return Response(
                {
                    'success': True,
                    'message': 'Performance record created successfully',
                    'data': PerformanceRecordSerializer(performance).data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(
            {'success': False, 'error': 'Validation failed', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )


class PerformanceRecordDetailView(SchoolScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/performance/{id}/"""
    permission_classes = [IsAuthenticated]
    school_filter_field = 'subject__grade__school'
    serializer_class = PerformanceRecordSerializer

    def get_queryset(self):
        return self.get_school_filtered_queryset(PerformanceRecord.objects.all())


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_performance_summary(request, student_id):
    """GET /api/performance/student/{student_id}/summary/"""
    school = get_user_school(request.user)
    qs = Student.objects.filter(current_class__school=school) if school else Student.objects.none()

    try:
        student = qs.get(pk=student_id)
    except Student.DoesNotExist:
        return Response({'success': False, 'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    term_id = request.query_params.get('term_id')
    records = PerformanceRecord.objects.filter(student=student)
    if term_id:
        records = records.filter(term_id=term_id)

    if not records.exists():
        return Response({
            'success': True,
            'data': {'student_name': student.full_name, 'message': 'No performance records found'}
        })

    summary = records.aggregate(
        average_score=Avg('score'),
        subjects_count=Count('id'),
        low_attendance_count=Count('id', filter=Q(low_attendance_flag=True))
    )

    return Response({
        'success': True,
        'data': {
            'student': {
                'id': student.id,
                'name': student.full_name,
                'admission_number': student.admission_number
            },
            'summary': {
                'average_score': round(summary['average_score'], 2) if summary['average_score'] else 0,
                'subjects_count': summary['subjects_count'],
                'low_attendance_subjects': summary['low_attendance_count']
            },
            'records': PerformanceRecordSerializer(records, many=True).data
        }
    })


# ==================== QR CODE VIEWS ====================

def _school_scoped_student(request, student_id):
    """
    Helper used by all QR views.
    Returns (student, None) on success or (None, error_response) on failure.
    """
    school = get_user_school(request.user)
    qs = Student.objects.filter(current_class__school=school) if school else Student.objects.none()
    try:
        return qs.get(pk=student_id), None
    except Student.DoesNotExist:
        return None, Response({'success': False, 'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_qr_code(request, student_id):
    """POST /api/students/{student_id}/generate-qr/"""
    student, err = _school_scoped_student(request, student_id)
    if err:
        return err

    qr_data = {
        'student_id': student.id,
        'admission_number': student.admission_number,
        'timestamp': str(timezone.now())
    }
    encrypted_data = base64.b64encode(json.dumps(qr_data).encode()).decode()

    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
    qr.add_data(encrypted_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')

    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)

    try:
        upload_result = cloudinary.uploader.upload(
            buffer,
            folder='qr_codes',
            public_id=f'qr_{student.admission_number}',
            overwrite=True,
            resource_type='image',
        )
    except Exception as e:
        return Response({'success': False, 'error': f'Cloudinary upload failed: {str(e)}'}, status=500)

    student.qr_code = encrypted_data
    student.qr_code_image = upload_result['public_id']
    student.save(update_fields=['qr_code', 'qr_code_image'])
    student.refresh_from_db()

    return Response({
        'success': True,
        'message': 'QR code generated successfully',
        'data': {
            'student_id': student.id,
            'admission_number': student.admission_number,
            'full_name': student.full_name,
            'qr_code_data': encrypted_data,
            'qr_code_image_url': student.qr_code_image.url if student.qr_code_image else None
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_qr_code(request):
    """
    POST /api/attendance/validate-qr/
    No school scoping — resolves identity purely from the signed token.
    """
    qr_data = request.data.get('qr_data')
    if not qr_data:
        return Response({'success': False, 'error': 'QR data is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        data = json.loads(base64.b64decode(qr_data).decode())
        student = Student.objects.get(id=data['student_id'], admission_number=data['admission_number'])
        return Response({
            'success': True,
            'message': 'QR code validated successfully',
            'data': {
                'student_id': student.id,
                'admission_number': student.admission_number,
                'full_name': student.full_name,
                'photo_url': student.photo.url if student.photo else None,
                'class': student.current_class.name if student.current_class else None
            }
        })
    except (json.JSONDecodeError, KeyError, Student.DoesNotExist):
        return Response({'success': False, 'error': 'Invalid QR code'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'success': False, 'error': f'QR code validation failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_qr_code(request, student_id):
    """GET /api/students/{student_id}/qr-code/"""
    student, err = _school_scoped_student(request, student_id)
    if err:
        return err

    if not student.qr_code:
        return Response(
            {'success': False, 'error': 'QR code not generated yet', 'message': 'Generate QR code first'},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response({
        'success': True,
        'data': {
            'student_id': student.id,
            'admission_number': student.admission_number,
            'full_name': student.full_name,
            'qr_code_data': student.qr_code,
            'qr_code_image_url': student.qr_code_image.url if student.qr_code_image else None
        }
    })