from django.urls import path
from . import views

app_name = 'students'

urlpatterns = [
    # Authentication
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/me/', views.current_user, name='current-user'),
    path('auth/forgot-password/', views.forgot_password, name='forgot-password'),
    path('auth/request-access/', views.request_access, name='request-access'),
    path('auth/change-password/', views.change_password, name='change-password'),
    
    # Students
    path('students/', views.StudentListCreateView.as_view(), name='student-list-create'),
    path('students/<int:pk>/', views.StudentDetailView.as_view(), name='student-detail'),
    path('students/<int:pk>/attendance/', views.student_attendance_history, name='student-attendance'),
    
    # Classes
    path('classes/', views.ClassListCreateView.as_view(), name='class-list-create'),
    path('classes/<int:pk>/', views.ClassDetailView.as_view(), name='class-detail'),
    path('classes/<int:pk>/students/', views.class_students, name='class-students'),
    
    # Teachers
    path('teachers/', views.TeacherListCreateView.as_view(), name='teacher-list-create'),
    path('teachers/<int:pk>/', views.TeacherDetailView.as_view(), name='teacher-detail'),
    path('teachers/<int:pk>/classes/', views.teacher_classes, name='teacher-classes'),
    
    # Schools
    path('schools/', views.SchoolListCreateView.as_view(), name='school-list-create'),
    path('schools/<int:pk>/', views.SchoolDetailView.as_view(), name='school-detail'),

    # ==================== GRADE URLS ====================
    path('grades/', views.GradeListCreateView.as_view(), name='grade-list-create'),
    path('grades/<int:pk>/', views.GradeDetailView.as_view(), name='grade-detail'),
    
    # ==================== TERM URLS ====================
    path('terms/', views.TermListCreateView.as_view(), name='term-list-create'),
    path('terms/<int:pk>/', views.TermDetailView.as_view(), name='term-detail'),
    
    # ==================== SUBJECT URLS ====================
    path('subjects/', views.SubjectListCreateView.as_view(), name='subject-list-create'),
    path('subjects/<int:pk>/', views.SubjectDetailView.as_view(), name='subject-detail'),
    
    # ==================== PERFORMANCE URLS ====================
    path('performance/', views.PerformanceRecordListCreateView.as_view(), name='performance-list-create'),
    path('performance/<int:pk>/', views.PerformanceRecordDetailView.as_view(), name='performance-detail'),
    path('performance/student/<int:student_id>/summary/', views.student_performance_summary, name='student-performance-summary'),
    
    # ==================== QR CODE URLS ====================
    path('students/<int:student_id>/generate-qr/', views.generate_qr_code, name='generate-qr-code'),
    path('students/<int:student_id>/qr-code/', views.get_student_qr_code, name='get-student-qr-code'),
    path('attendance/validate-qr/', views.validate_qr_code, name='validate-qr-code'),
]