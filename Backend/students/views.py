# Backend/students/views.py
# API views for authentication and user management

from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.middleware.csrf import get_token
from rest_framework.authentication import SessionAuthentication

from .models import User
from .serializers import UserSerializer

from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Avg
from django.utils import timezone
from datetime import date
import qrcode
from io import BytesIO
from django.core.files import File
import json
import base64
from cryptography.fernet import Fernet
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.middleware.csrf import get_token

from .models import Student, Class, Teacher, School, Grade, Term, Subject, PerformanceRecord, Student
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
    StudentQRCodeSerializer
)

from attendance.models import AttendanceRecord

@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    token = get_token(request)
    return Response({'csrfToken': token})

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Login endpoint
    POST /api/auth/login/
    Body: {
        "email": "teacher@school.edu",
        "password": "password123",
        "remember_me": true
    }
    """
    email = request.data.get('email')
    password = request.data.get('password')
    remember_me = request.data.get('remember_me', False)
    
    if not email or not password:
        return Response(
            {
                'success': False,
                'error': 'Email and password are required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Try to find user by email
    try:
        user = User.objects.get(email=email)
        username = user.username
    except User.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Invalid credentials'
            },
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    
    # Authenticate user
    user = authenticate(request, username=username, password=password)
    
    if user is not None:
        if user.is_active:
            login(request, user)
            
            # Set session expiry
            if not remember_me:
                request.session.set_expiry(0)  # Session expires when browser closes
            else:
                request.session.set_expiry(86400 * 7)  # 7 days
            
            # Serialize user data
            user_data = UserSerializer(user).data
            
            return Response(
                {
                    'success': True,
                    'message': 'Login successful',
                    'user': user_data,
                },
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {
                    'success': False,
                    'error': 'Account is inactive'
                },
                status=status.HTTP_403_FORBIDDEN
            )
    else:
        return Response(
            {
                'success': False,
                'error': 'Invalid credentials'
            },
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout endpoint
    POST /api/auth/logout/
    """

    logout(request)
    return Response(
        {
            'success': True,
            'message': 'Logout successful'
        },
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    Get current authenticated user
    GET /api/auth/me/
    """
    serializer = UserSerializer(request.user)
    return Response(
        {
            'success': True,
            'user': serializer.data
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    """
    Forgot password endpoint
    POST /api/auth/forgot-password/
    Body: {"email": "user@example.com"}
    
    Note: This is a placeholder. Implement email sending in production.
    """
    email = request.data.get('email')
    
    if not email:
        return Response(
            {
                'success': False,
                'error': 'Email is required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        user = User.objects.get(email=email)
        
        # TODO: In production, send password reset email here
        # For now, just return success message
        
        return Response(
            {
                'success': True,
                'message': 'Password reset instructions have been sent to your email'
            },
            status=status.HTTP_200_OK
        )
    except User.DoesNotExist:
        # Don't reveal if email exists or not (security best practice)
        return Response(
            {
                'success': True,
                'message': 'If an account exists with this email, password reset instructions have been sent'
            },
            status=status.HTTP_200_OK
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def request_access(request):
    """
    Request access for new teachers
    POST /api/auth/request-access/
    Body: {
        "full_name": "John Doe",
        "email": "john@example.com",
        "school": "Green Valley Primary School",
        "message": "I would like to request access..."
    }
    
    Note: This creates a notification for admins to review.
    """
    full_name = request.data.get('full_name')
    email = request.data.get('email')
    school = request.data.get('school')
    message = request.data.get('message', '')
    
    if not all([full_name, email, school]):
        return Response(
            {
                'success': False,
                'error': 'Full name, email, and school are required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # TODO: In production, create access request record and notify admins
    # For MVP, just return success
    
    return Response(
        {
            'success': True,
            'message': 'Access request submitted successfully. An administrator will review your request.'
        },
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def change_password(request):
    """
    Change password for authenticated user
    POST /api/auth/change-password/
    Body: {
        "old_password": "current_password",
        "new_password": "new_password"
    }
    """
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    
    if not old_password or not new_password:
        return Response(
            {
                'success': False,
                'error': 'Both old and new passwords are required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if old password is correct
    if not user.check_password(old_password):
        return Response(
            {
                'success': False,
                'error': 'Current password is incorrect'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Set new password
    user.set_password(new_password)
    user.save()
    
    return Response(
        {
            'success': True,
            'message': 'Password changed successfully'
        },
        status=status.HTTP_200_OK
    )


# ==================== STUDENT VIEWS ====================

class StudentListCreateView(generics.ListCreateAPIView):
    """
    GET /api/students/
    POST /api/students/
    
    List all students with search, filter, pagination
    Create new student
    """
    permission_classes = [IsAuthenticated]
    filterset_fields = ['current_class', 'status', 'gender']
    search_fields = ['first_name', 'last_name', 'admission_number', 'parent_name', 'parent_phone']
    ordering_fields = ['first_name', 'last_name', 'admission_number', 'enrollment_date']
    ordering = ['first_name', 'last_name']
    
    def get_queryset(self):
        queryset = Student.objects.select_related('current_class').all()
        
        # Filter by search query
        
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(admission_number__icontains=search) |
                Q(parent_name__icontains=search) |
                Q(parent_phone__icontains=search) |
                Q(email__icontains=search)
            )
        
        # Filter by grade
        grade = self.request.query_params.get('grade', None)
        if grade and grade.lower() != 'all':
            queryset = queryset.filter(current_class__grade_level=grade)
        
        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter and status_filter.lower() != 'all':
            queryset = queryset.filter(status=status_filter)
        
        return queryset
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StudentCreateUpdateSerializer
        return StudentListSerializer
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        
        # Add statistics
        today = date.today()
        
        statistics = {
            'total_active': Student.objects.filter(status='active').count(),
            'avg_attendance': 94.2,  # TODO: Calculate from actual attendance data
            'birthdays_today': Student.objects.filter(
                status='active',
                date_of_birth__month=today.month,
                date_of_birth__day=today.day
            ).count()
        }
        
        response.data['statistics'] = statistics
        return response
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'success': True,
                    'message': 'Student created successfully',
                    'data': serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(
            {
                'success': False,
                'error': 'Validation failed',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/students/{id}/
    PUT /api/students/{id}/
    DELETE /api/students/{id}/
    
    Retrieve, update, or delete a student
    """
    permission_classes = [IsAuthenticated]
    queryset = Student.objects.select_related('current_class').all()
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return StudentCreateUpdateSerializer
        return StudentDetailSerializer
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(
            {
                'success': True,
                'data': serializer.data
            },
            status=status.HTTP_200_OK
        )
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'success': True,
                    'message': 'Student updated successfully',
                    'data': serializer.data
                },
                status=status.HTTP_200_OK
            )
        return Response(
            {
                'success': False,
                'error': 'Validation failed',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(
            {
                'success': True,
                'message': 'Student deleted successfully'
            },
            status=status.HTTP_200_OK
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_attendance_history(request, pk):
    """
    GET /api/students/{id}/attendance/
    
    Get attendance history for a student
    """
    try:
        student = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Student not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get date range from query params
    start_date = request.query_params.get('start_date', None)
    end_date = request.query_params.get('end_date', None)
    
    records_query = AttendanceRecord.objects.filter(student=student).order_by('date')

    if start_date:
        records_query = records_query.filter(date__gte = start_date)
    if end_date:
        records_query = records_query.filter(date__lte = end_date)

    records_data = [
        {
            'date': str(record.date),
            'status': record.status,
            'subject': record.class_session.name if record.class_session else None,
        }
        for record in records_query
    ]
    
    return Response(
        {
            'success': True,
            'data': {
                'student': StudentDetailSerializer(student).data,
                'attendance_percentage': student.get_attendance_percentage(start_date, end_date),
                'records': records_data
            }
        },
        status=status.HTTP_200_OK
    )


# ==================== CLASS VIEWS ====================

class ClassListCreateView(generics.ListCreateAPIView):
    """
    GET /api/classes/
    POST /api/classes/
    
    List all classes and create new class
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ClassSerializer
    queryset = Class.objects.select_related('school', 'class_teacher').all()
    filterset_fields = ['grade_level', 'academic_year', 'school']
    ordering_fields = ['grade_level', 'section']
    ordering = ['grade_level', 'section']
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(
            {
                'success': True,
                'data': response.data
            },
            status=status.HTTP_200_OK
        )
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'success': True,
                    'message': 'Class created successfully',
                    'data': serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(
            {
                'success': False,
                'error': 'Validation failed',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )


class ClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/classes/{id}/
    PUT /api/classes/{id}/
    DELETE /api/classes/{id}/
    
    Retrieve, update, or delete a class
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ClassSerializer
    queryset = Class.objects.select_related('school', 'class_teacher').all()
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(
            {
                'success': True,
                'data': serializer.data
            },
            status=status.HTTP_200_OK
        )


@api_view(['GET'])
def class_students(request, pk):
    """
    GET /api/classes/{id}/students/
    
    Get all students in a specific class
    """
    try:
        class_obj = Class.objects.get(pk=pk)
    except Class.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Class not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    students = Student.objects.filter(current_class=class_obj, is_active=True)
    serializer = StudentListSerializer(students, many=True)
    
    return Response(
        {
            'success': True,
            'data': {
                'class': ClassSerializer(class_obj).data,
                'students': serializer.data,
                'total_students': students.count()
            }
        },
        status=status.HTTP_200_OK
    )


# ==================== TEACHER VIEWS ====================

class TeacherListCreateView(generics.ListCreateAPIView):
    """
    GET /api/teachers/
    POST /api/teachers/
    """
    permission_classes = [IsAuthenticated]
    queryset = Teacher.objects.prefetch_related('classes').all()
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TeacherCreateUpdateSerializer
        return TeacherListSerializer
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(
            {
                'success': True,
                'data': response.data
            },
            status=status.HTTP_200_OK
        )


class TeacherDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/teachers/{id}/
    PUT /api/teachers/{id}/
    DELETE /api/teachers/{id}/
    """
    permission_classes = [IsAuthenticated]
    queryset = Teacher.objects.prefetch_related('classes').all()
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return TeacherCreateUpdateSerializer
        return TeacherDetailSerializer


@api_view(['GET'])
def teacher_classes(request, pk):
    """
    GET /api/teachers/{id}/classes/
    
    Get all classes assigned to a teacher
    """
    try:
        teacher = Teacher.objects.get(pk=pk)
    except Teacher.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Teacher not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    classes = teacher.classes.all()
    serializer = ClassSerializer(classes, many=True)
    
    return Response(
        {
            'success': True,
            'data': serializer.data
        },
        status=status.HTTP_200_OK
    )


# ==================== SCHOOL VIEWS ====================

class SchoolListCreateView(generics.ListCreateAPIView):
    """
    GET /api/schools/
    POST /api/schools/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SchoolSerializer
    queryset = School.objects.all()


class SchoolDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/schools/{id}/
    PUT /api/schools/{id}/
    DELETE /api/schools/{id}/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SchoolSerializer
    queryset = School.objects.all()


# ==================== GRADE VIEWS ====================

class GradeListCreateView(generics.ListCreateAPIView):
    """
    GET /api/grades/
    POST /api/grades/
    
    List all grades and create new grade
    """
    permission_classes = [IsAuthenticated]
    queryset = Grade.objects.select_related('school').all()
    filterset_fields = ['school', 'school_year', 'is_active']
    ordering = ['level', 'school_year']
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return GradeSerializer
        return GradeListSerializer
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(
            {
                'success': True,
                'data': response.data
            },
            status=status.HTTP_200_OK
        )
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'success': True,
                    'message': 'Grade created successfully',
                    'data': serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(
            {
                'success': False,
                'error': 'Validation failed',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )


class GradeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/grades/{id}/
    PUT /api/grades/{id}/
    DELETE /api/grades/{id}/
    """
    permission_classes = [IsAuthenticated]
    queryset = Grade.objects.all()
    serializer_class = GradeSerializer


# ==================== TERM VIEWS ====================

class TermListCreateView(generics.ListCreateAPIView):
    """
    GET /api/terms/
    POST /api/terms/
    
    List all terms and create new term
    Query params: ?grade_id=1 to filter by grade
    """
    permission_classes = [IsAuthenticated]
    queryset = Term.objects.select_related('grade').all()
    filterset_fields = ['grade', 'is_active']
    ordering = ['-start_date']
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TermSerializer
        return TermListSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        grade_id = self.request.query_params.get('grade_id', None)
        if grade_id:
            queryset = queryset.filter(grade_id=grade_id)
        return queryset
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(
            {
                'success': True,
                'data': response.data
            },
            status=status.HTTP_200_OK
        )
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'success': True,
                    'message': 'Term created successfully',
                    'data': serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(
            {
                'success': False,
                'error': 'Validation failed',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )


class TermDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/terms/{id}/
    PUT /api/terms/{id}/
    DELETE /api/terms/{id}/
    """
    permission_classes = [IsAuthenticated]
    queryset = Term.objects.all()
    serializer_class = TermSerializer


# ==================== SUBJECT VIEWS ====================

class SubjectListCreateView(generics.ListCreateAPIView):
    """
    GET /api/subjects/
    POST /api/subjects/
    
    List all subjects and create new subject
    Query params: ?grade_id=1&term_id=1 to filter
    """
    permission_classes = [IsAuthenticated]
    queryset = Subject.objects.select_related('grade', 'term', 'teacher').all()
    filterset_fields = ['grade', 'term', 'teacher', 'is_active']
    ordering = ['name']
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SubjectSerializer
        return SubjectListSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        grade_id = self.request.query_params.get('grade_id', None)
        term_id = self.request.query_params.get('term_id', None)
        
        if grade_id:
            queryset = queryset.filter(grade_id=grade_id)
        if term_id:
            queryset = queryset.filter(term_id=term_id)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(
            {
                'success': True,
                'data': response.data
            },
            status=status.HTTP_200_OK
        )
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'success': True,
                    'message': 'Subject created successfully',
                    'data': serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(
            {
                'success': False,
                'error': 'Validation failed',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )


class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/subjects/{id}/
    PUT /api/subjects/{id}/
    DELETE /api/subjects/{id}/
    """
    permission_classes = [IsAuthenticated]
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer


# ==================== PERFORMANCE VIEWS ====================

class PerformanceRecordListCreateView(generics.ListCreateAPIView):
    """
    GET /api/performance/
    POST /api/performance/
    
    List performance records and create new record
    Query params: ?student_id=1&term_id=1&subject_id=1
    """
    permission_classes = [IsAuthenticated]
    queryset = PerformanceRecord.objects.select_related(
        'student', 'subject', 'term', 'created_by'
    ).all()
    filterset_fields = ['student', 'subject', 'term']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PerformanceRecordCreateSerializer
        return PerformanceRecordListSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student_id', None)
        term_id = self.request.query_params.get('term_id', None)
        subject_id = self.request.query_params.get('subject_id', None)
        
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if term_id:
            queryset = queryset.filter(term_id=term_id)
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            performance = serializer.save()
            
            # Return detailed serializer
            detail_serializer = PerformanceRecordSerializer(performance)
            
            return Response(
                {
                    'success': True,
                    'message': 'Performance record created successfully',
                    'data': detail_serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(
            {
                'success': False,
                'error': 'Validation failed',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )


class PerformanceRecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/performance/{id}/
    PUT /api/performance/{id}/
    DELETE /api/performance/{id}/
    """
    permission_classes = [IsAuthenticated]
    queryset = PerformanceRecord.objects.all()
    serializer_class = PerformanceRecordSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_performance_summary(request, student_id):
    """
    GET /api/performance/student/{student_id}/summary/
    
    Get performance summary for a student
    Query params: ?term_id=1 (optional)
    """
    try:
        student = Student.objects.get(pk=student_id)
    except Student.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Student not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    term_id = request.query_params.get('term_id', None)
    
    # Get all performance records for student
    records = PerformanceRecord.objects.filter(student=student)
    
    if term_id:
        records = records.filter(term_id=term_id)
    
    if not records.exists():
        return Response(
            {
                'success': True,
                'data': {
                    'student_name': student.full_name,
                    'message': 'No performance records found'
                }
            },
            status=status.HTTP_200_OK
        )
    
    # Calculate summary
    summary = records.aggregate(
        average_score=Avg('score'),
        subjects_count=Count('id'),
        low_attendance_count=Count('id', filter=Q(low_attendance_flag=True))
    )
    
    # Get all records
    records_data = PerformanceRecordSerializer(records, many=True).data
    
    return Response(
        {
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
                'records': records_data
            }
        },
        status=status.HTTP_200_OK
    )


# ==================== QR CODE VIEWS ====================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_qr_code(request, student_id):
    """
    POST /api/students/{student_id}/generate-qr/
    
    Generate QR code for a student
    """
    try:
        student = Student.objects.get(pk=student_id)
    except Student.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Student not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Create QR data (encrypted)
    qr_data = {
        'student_id': student.id,
        'admission_number': student.admission_number,
        'timestamp': str(timezone.now())
    }
    
    # Convert to JSON string
    qr_string = json.dumps(qr_data)
    
    # Encrypt the data (simple base64 for MVP, use proper encryption in production)
    encrypted_data = base64.b64encode(qr_string.encode()).decode()
    
    # Generate QR code image
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(encrypted_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to BytesIO
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    # Save to student model
    file_name = f'qr_{student.admission_number}.png'
    student.qr_code = encrypted_data
    student.qr_code_image = File(buffer, name=file_name)
    student.save(update_fields=['qr_code', 'qr_code_image'])

    student.refresh_from_db()
    
    return Response(
        {
            'success': True,
            'message': 'QR code generated successfully',
            'data': {
                'student_id': student.id,
                'admission_number': student.admission_number,
                'full_name': student.full_name,
                'qr_code_data': encrypted_data,
                'qr_code_image_url': student.qr_code_image.url if student.qr_code_image else None
            }
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_qr_code(request):
    """
    POST /api/attendance/validate-qr/
    
    Validate scanned QR code and return student info
    Body: {"qr_data": "encrypted_string"}
    """
    qr_data = request.data.get('qr_data')
    
    if not qr_data:
        return Response(
            {
                'success': False,
                'error': 'QR data is required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Decrypt the data
        decrypted_string = base64.b64decode(qr_data).decode()
        data = json.loads(decrypted_string)
        
        student_id = data.get('student_id')
        admission_number = data.get('admission_number')
        
        # Find student
        student = Student.objects.get(id=student_id, admission_number=admission_number)
        
        return Response(
            {
                'success': True,
                'message': 'QR code validated successfully',
                'data': {
                    'student_id': student.id,
                    'admission_number': student.admission_number,
                    'full_name': student.full_name,
                    'photo_url': student.photo.url if student.photo else None,
                    'class': student.current_class.name if student.current_class else None
                }
            },
            status=status.HTTP_200_OK
        )
    
    except (json.JSONDecodeError, KeyError, Student.DoesNotExist):
        return Response(
            {
                'success': False,
                'error': 'Invalid QR code'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {
                'success': False,
                'error': f'QR code validation failed: {str(e)}'
            },
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_qr_code(request, student_id):
    """
    GET /api/students/{student_id}/qr-code/
    
    Get existing QR code for a student
    """
    try:
        student = Student.objects.get(pk=student_id)
    except Student.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Student not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    if not student.qr_code:
        return Response(
            {
                'success': False,
                'error': 'QR code not generated yet',
                'message': 'Generate QR code first'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    return Response(
        {
            'success': True,
            'data': {
                'student_id': student.id,
                'admission_number': student.admission_number,
                'full_name': student.full_name,
                'qr_code_data': student.qr_code,
                'qr_code_image_url': student.qr_code_image.url if student.qr_code_image else None
            }
        },
        status=status.HTTP_200_OK
    )