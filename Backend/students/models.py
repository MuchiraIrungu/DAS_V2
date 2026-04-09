# Backend/students/models.py
# Updated models based on UI design requirements

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.contrib.auth.models import AbstractUser
from cloudinary.models import CloudinaryField

class User(AbstractUser):
    """Custom user model with roles"""
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
        ('class_rep', 'Class Representative'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    phone = models.CharField(max_length=15, blank=True, null=True)
    photo = models.ImageField(upload_to='users/', blank=True, null=True)
    
    # Fix the groups and permissions clash
    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to.',
        related_name='custom_user_set', 
        related_query_name='custom_user',
    )
    
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name='custom_user_set',  
        related_query_name='custom_user',
    )
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

class School(models.Model):
    """School information"""
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    address = models.TextField()
    phone = models.CharField(max_length=15)
    email = models.EmailField()
    logo = models.ImageField(upload_to='schools/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name


class Class(models.Model):
    """Class/Grade information"""
    name = models.CharField(max_length=100)  # e.g., "Grade 5A"
    grade_level = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    section = models.CharField(max_length=10)  # A, B, C, etc.
    nickname = models.CharField(max_length=100, blank=True, null=True)  # e.g., "Bluebirds"
    academic_year = models.CharField(max_length=9)  # e.g., "2025-2026"
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='classes')
    class_teacher = models.ForeignKey(
        'Teacher', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='main_class'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Classes"
        ordering = ['grade_level', 'section']
    
    def __str__(self):
        return self.get_display_name()
    
    def get_display_name(self):
        """Returns: Grade 3-A (Bluebirds) or just Grade 3-A if no nickname"""
        if self.nickname:
            return f"{self.name} ({self.nickname})"
        return self.name
    
    @property
    def student_count(self):
        """Total number of students in this class"""
        return self.students.filter(is_active=True).count()


class Student(models.Model):
    """Student information"""
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('on_leave', 'On Leave'),
        ('inactive', 'Inactive'),
    ]
    
    # Basic Information
    admission_number = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True, null=True)  # NEW: Student email
    photo = models.ImageField(upload_to='students/', blank=True, null=True)  # NEW: Photo
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    
    # Status
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='active'
    )  # NEW: Status field for UI badges
    is_active = models.BooleanField(default=True)  # Keep for backward compatibility
    
    # Class Information
    current_class = models.ForeignKey(
        Class, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='students'
    )
    
    # Parent/Guardian Information
    parent_name = models.CharField(max_length=200)
    parent_phone = models.CharField(max_length=15)
    parent_email = models.EmailField(blank=True, null=True)
    address = models.TextField()
    
    # Dates
    enrollment_date = models.DateField()
    
    # User Account (optional)
    user = models.OneToOneField(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='student_profile'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    qr_code = models.CharField(max_length=500, blank=True, null=True)  # Store QR code data
    qr_code_image = CloudinaryField('qr_codes', blank=True, null=True, folder='qr_codes')
    
    class Meta:
        ordering = ['first_name', 'last_name']
        indexes = [
            models.Index(fields=['admission_number']),
            models.Index(fields=['current_class', 'status']),
        ]
    
    def __str__(self):
        return f"{self.full_name} ({self.admission_number})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def age(self):
        """Calculate student's age"""
        today = timezone.now().date()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )
    
    @property
    def is_birthday_today(self):
        """Check if today is student's birthday"""
        today = timezone.now().date()
        return (self.date_of_birth.month == today.month and 
                self.date_of_birth.day == today.day)
    
    def get_attendance_percentage(self, start_date=None, end_date=None):
        """Calculate attendance percentage for a date range"""
        from attendance.models import AttendanceRecord
        
        if not start_date:
            start_date = timezone.now().date().replace(day=1)  # First day of current month
        if not end_date:
            end_date = timezone.now().date()
        
        records = AttendanceRecord.objects.filter(
            student=self,
            date__range=[start_date, end_date]
        )
        
        total = records.count()
        if total == 0:
            return 0.0
        
        present = records.filter(status='P').count()
        return round((present / total) * 100, 2)


class Teacher(models.Model):
    """Teacher information"""
    # Basic Information
    employee_id = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15)
    photo = models.ImageField(upload_to='teachers/', blank=True, null=True)  # NEW: Photo
    
    # Professional Information
    subject_specialization = models.CharField(max_length=100, blank=True)
    classes = models.ManyToManyField(
        Class, 
        related_name='teachers',
        blank=True
    )
    
    # User Account
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE,
        related_name='teacher_profile'
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['first_name', 'last_name']
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['email']),
        ]
    
    def __str__(self):
        return self.full_name
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def assigned_classes_count(self):
        """Number of classes assigned to this teacher"""
        return self.classes.count()
    
    def get_main_class(self):
        """Get the class where this teacher is the class teacher"""
        return Class.objects.filter(class_teacher=self).first()



#QR_CODE handling



# ==================== NEW MODELS FOR PHASE 2.5 ====================

class Grade(models.Model):
    """
    Grade/Year level (e.g., Grade 10, Year 5)
    Organizes classes by academic level
    """
    name = models.CharField(max_length=50)  # "Grade 10", "Year 5"
    level = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    school_year = models.CharField(max_length=9)  # "2025-2026"
    school = models.ForeignKey('School', on_delete=models.CASCADE, related_name='grades')
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['level', 'school_year']
        unique_together = ['school', 'level', 'school_year']
    
    def __str__(self):
        return f"{self.name} ({self.school_year})"


class Term(models.Model):
    """
    Academic term/semester within a grade
    (e.g., Semester 1 2026, Term 1, Quarter 1)
    """
    TERM_TYPE_CHOICES = [
        ('semester', 'Semester'),
        ('term', 'Term'),
        ('quarter', 'Quarter'),
    ]
    
    name = models.CharField(max_length=100)  # "Semester 1, 2026"
    term_type = models.CharField(max_length=20, choices=TERM_TYPE_CHOICES, default='semester')
    term_number = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(4)])
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name='terms')
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['start_date']
        unique_together = ['grade', 'term_number', 'start_date']
    
    def __str__(self):
        return f"{self.name} - {self.grade.name}"
    
    def clean(self):
        """Validate that end_date is after start_date"""
        from django.core.exceptions import ValidationError
        if self.end_date and self.start_date and self.end_date <= self.start_date:
            raise ValidationError('End date must be after start date')
    
    @property
    def duration_days(self):
        """Calculate term duration in days"""
        return (self.end_date - self.start_date).days
    
    @property
    def is_current(self):
        """Check if term is currently active"""
        today = timezone.now().date()
        return self.start_date <= today <= self.end_date


class Subject(models.Model):
    """
    Subject/Course taught in a specific grade and term
    (e.g., Mathematics, Science, English)
    """
    name = models.CharField(max_length=100)  # "Mathematics", "Science"
    code = models.CharField(max_length=20, unique=True)  # "MATH101", "SCI201"
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name='subjects')
    term = models.ForeignKey(Term, on_delete=models.CASCADE, related_name='subjects')
    teacher = models.ForeignKey(
        'Teacher', 
        on_delete=models.SET_NULL, 
        null=True,
        blank=True,
        related_name='assigned_subjects'
    )
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        unique_together = ['grade', 'term', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.code}) - {self.grade.name}"


class PerformanceRecord(models.Model):
    """
    Student performance/grades for a subject in a term
    Links to attendance to show correlation
    """
    GRADE_CHOICES = [
        ('A+', 'A+ (90-100)'),
        ('A', 'A (85-89)'),
        ('B+', 'B+ (80-84)'),
        ('B', 'B (75-79)'),
        ('C+', 'C+ (70-74)'),
        ('C', 'C (65-69)'),
        ('D', 'D (60-64)'),
        ('F', 'F (Below 60)'),
    ]
    
    student = models.ForeignKey(
        'Student', 
        on_delete=models.CASCADE,
        related_name='performance_records'
    )
    subject = models.ForeignKey(
        Subject, 
        on_delete=models.CASCADE,
        related_name='performance_records'
    )
    term = models.ForeignKey(
        Term,
        on_delete=models.CASCADE,
        related_name='performance_records'
    )
    
    # Performance data
    score = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    grade = models.CharField(max_length=2, choices=GRADE_CHOICES)
    comments = models.TextField(blank=True, null=True)
    
    # Attendance correlation
    attendance_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    low_attendance_flag = models.BooleanField(default=False)
    
    # Tracking
    created_by = models.ForeignKey(
        'Teacher',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_performance_records'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['student', 'subject', 'term']
        indexes = [
            models.Index(fields=['student', 'term']),
            models.Index(fields=['subject', 'term']),
        ]
    
    def __str__(self):
        return f"{self.student.full_name} - {self.subject.name} - {self.grade}"
    
    def calculate_grade(self):
        """Auto-calculate letter grade from score"""
        score = float(self.score)
        if score >= 90:
            return 'A+'
        elif score >= 85:
            return 'A'
        elif score >= 80:
            return 'B+'
        elif score >= 75:
            return 'B'
        elif score >= 70:
            return 'C+'
        elif score >= 65:
            return 'C'
        elif score >= 60:
            return 'D'
        else:
            return 'F'
    
    def save(self, *args, **kwargs):
        """Auto-calculate grade and check attendance correlation"""
        # Auto-calculate grade if not provided
        if not self.grade:
            self.grade = self.calculate_grade()
        
        # Check attendance correlation
        if self.attendance_percentage and self.attendance_percentage < 75:
            self.low_attendance_flag = True
        
        super().save(*args, **kwargs)
