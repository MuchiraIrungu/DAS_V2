# Backend/attendance/models.py
# Updated attendance models based on UI design requirements

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from students.models import Student, Class, Teacher


class AttendanceRecord(models.Model):
    """Daily attendance records for individual students"""
    STATUS_CHOICES = [
        ('P', 'Present'),
        ('A', 'Absent'),
        ('L', 'Late'),
        ('E', 'Excused'),
    ]
    
    student = models.ForeignKey(
        Student, 
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    class_session = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date = models.DateField()
    status = models.CharField(max_length=1, choices=STATUS_CHOICES, default='P')
    remarks = models.TextField(blank=True, null=True)
    marked_by = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        related_name='marked_attendance'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['student', 'date']
        ordering = ['-date', 'student__first_name']
        indexes = [
            models.Index(fields=['date', 'class_session']),
            models.Index(fields=['student', 'date']),
            models.Index(fields=['status', 'date']),
        ]
    
    def __str__(self):
        return f"{self.student.full_name} - {self.date} ({self.get_status_display()})"
    
    @property
    def is_present(self):
        return self.status == 'P'
    
    @property
    def is_absent(self):
        return self.status == 'A'
    
    subject = models.ForeignKey(
    'students.Subject',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='attendance_records'
    )


class AttendanceSubmission(models.Model):
    """
    Track when teachers submit attendance for a class
    Used for the "Recent Attendance Submissions" table in admin dashboard
    """
    SUBMISSION_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
    ]
    
    teacher = models.ForeignKey(
        Teacher, 
        on_delete=models.CASCADE,
        related_name='attendance_submissions'
    )
    class_session = models.ForeignKey(
        Class, 
        on_delete=models.CASCADE,
        related_name='attendance_submissions'
    )
    date = models.DateField()
    
    # Statistics
    total_students = models.IntegerField()
    present_count = models.IntegerField(default=0)
    absent_count = models.IntegerField(default=0)
    late_count = models.IntegerField(default=0)
    excused_count = models.IntegerField(default=0)
    
    # Submission details
    status = models.CharField(
        max_length=20,
        choices=SUBMISSION_STATUS_CHOICES,
        default='pending'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['teacher', 'class_session', 'date']
        ordering = ['-date', '-submitted_at']
        indexes = [
            models.Index(fields=['date', 'status']),
            models.Index(fields=['teacher', 'date']),
        ]
    
    def __str__(self):
        return f"{self.teacher.full_name} - {self.class_session.name} - {self.date}"
    
    @property
    def submission_time(self):
        """Return formatted submission time (e.g., '08:15 AM')"""
        return self.submitted_at.strftime('%I:%M %p')
    
    @property
    def attendance_percentage(self):
        """Calculate attendance percentage for this submission"""
        if self.total_students == 0:
            return 0.0
        return round((self.present_count / self.total_students) * 100, 2)
    
    def update_counts(self):
        """Recalculate attendance counts from records"""
        records = AttendanceRecord.objects.filter(
            class_session=self.class_session,
            date=self.date
        )
        
        self.total_students = records.count()
        self.present_count = records.filter(status='P').count()
        self.absent_count = records.filter(status='A').count()
        self.late_count = records.filter(status='L').count()
        self.excused_count = records.filter(status='E').count()
        self.save()


class AttendanceSummary(models.Model):
    """
    Monthly attendance summary for students
    Used for calculating attendance percentages and generating reports
    """
    student = models.ForeignKey(
        Student, 
        on_delete=models.CASCADE,
        related_name='attendance_summaries'
    )
    month = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    year = models.IntegerField()
    
    # Counts
    total_days = models.IntegerField(default=0)
    present_days = models.IntegerField(default=0)
    absent_days = models.IntegerField(default=0)
    late_days = models.IntegerField(default=0)
    excused_days = models.IntegerField(default=0)
    
    # Calculated percentage
    attendance_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        default=0.0
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['student', 'month', 'year']
        verbose_name_plural = "Attendance Summaries"
        ordering = ['-year', '-month']
        indexes = [
            models.Index(fields=['student', 'year', 'month']),
        ]
    
    def __str__(self):
        return f"{self.student.full_name} - {self.month}/{self.year}"
    
    def calculate_percentage(self):
        """Calculate and save attendance percentage"""
        if self.total_days > 0:
            self.attendance_percentage = round(
                (self.present_days / self.total_days) * 100, 2
            )
        else:
            self.attendance_percentage = 0.0
        return self.attendance_percentage
    
    def recalculate_from_records(self):
        """Recalculate summary from actual attendance records"""
        from datetime import date
        
        start_date = date(self.year, self.month, 1)
        
        # Calculate end date (last day of month)
        if self.month == 12:
            end_date = date(self.year + 1, 1, 1)
        else:
            end_date = date(self.year, self.month + 1, 1)
        
        records = AttendanceRecord.objects.filter(
            student=self.student,
            date__gte=start_date,
            date__lt=end_date
        )
        
        self.total_days = records.count()
        self.present_days = records.filter(status='P').count()
        self.absent_days = records.filter(status='A').count()
        self.late_days = records.filter(status='L').count()
        self.excused_days = records.filter(status='E').count()
        
        self.calculate_percentage()
        self.save()


class SystemStatus(models.Model):
    """
    Track system health status
    Displayed on login page: "System Status: All Systems Operational"
    """
    STATUS_CHOICES = [
        ('operational', 'All Systems Operational'),
        ('degraded', 'Degraded Performance'),
        ('maintenance', 'Under Maintenance'),
        ('down', 'System Down'),
    ]
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='operational'
    )
    message = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "System Statuses"
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.get_status_display()} - {self.updated_at.strftime('%Y-%m-%d %H:%M')}"
    
    @classmethod
    def get_current_status(cls):
        """Get the most recent active system status"""
        return cls.objects.filter(is_active=True).first()


class FlaggedAbsence(models.Model):
    """
    Track students with concerning absence patterns
    Displayed in dashboard: "Flagged Absences: 12"
    """
    PRIORITY_CHOICES = [
        ('low', 'Low Priority'),
        ('medium', 'Medium Priority'),
        ('high', 'High Priority'),
        ('critical', 'Critical'),
    ]
    
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='flagged_absences'
    )
    
    # Absence details
    consecutive_absences = models.IntegerField(default=0)
    total_absences_this_month = models.IntegerField(default=0)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    
    # Flag details
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='low')
    reason = models.TextField(blank=True)
    is_resolved = models.BooleanField(default=False)
    
    # Action taken
    action_taken = models.TextField(blank=True)
    followed_up_by = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='followed_up_absences'
    )
    
    # Timestamps
    flagged_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-priority', '-flagged_at']
        indexes = [
            models.Index(fields=['is_resolved', 'priority']),
            models.Index(fields=['student', 'is_resolved']),
        ]
    
    def __str__(self):
        return f"{self.student.full_name} - {self.get_priority_display()}"
    
    def mark_as_resolved(self, action_taken, followed_up_by=None):
        """Mark the flagged absence as resolved"""
        self.is_resolved = True
        self.resolved_at = timezone.now()
        self.action_taken = action_taken
        if followed_up_by:
            self.followed_up_by = followed_up_by
        self.save()