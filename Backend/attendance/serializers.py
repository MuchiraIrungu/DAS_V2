# Backend/attendance/serializers.py
# Serializers for attendance models

from rest_framework import serializers
from .models import (
    AttendanceRecord, 
    AttendanceSubmission,
    AttendanceSummary,
    SystemStatus,
    FlaggedAbsence
)
from students.serializers import StudentListSerializer, TeacherListSerializer


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer for attendance records"""
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_admission_number = serializers.CharField(
        source='student.admission_number', 
        read_only=True
    )
    class_name = serializers.CharField(source='class_session.name', read_only=True)
    marked_by_name = serializers.CharField(
        source='marked_by.full_name', 
        read_only=True
    )
    is_present = serializers.ReadOnlyField()
    is_absent = serializers.ReadOnlyField()
    
    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'student', 'student_name', 'student_admission_number',
            'class_session', 'class_name', 'date', 'status',
            'remarks', 'marked_by', 'marked_by_name',
            'is_present', 'is_absent', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class AttendanceRecordCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating attendance records"""
    
    class Meta:
        model = AttendanceRecord
        fields = ['student', 'class_session', 'date', 'status', 'remarks', 'marked_by']
    
    def validate(self, data):
        """Ensure no duplicate attendance for same student on same date"""
        student = data.get('student')
        date = data.get('date')
        
        # Check if updating
        if self.instance:
            if AttendanceRecord.objects.exclude(pk=self.instance.pk).filter(
                student=student, date=date
            ).exists():
                raise serializers.ValidationError(
                    "Attendance record already exists for this student on this date."
                )
        else:
            if AttendanceRecord.objects.filter(student=student, date=date).exists():
                raise serializers.ValidationError(
                    "Attendance record already exists for this student on this date."
                )
        
        return data


class BulkAttendanceSerializer(serializers.Serializer):
    """Serializer for bulk attendance marking"""
    class_id = serializers.IntegerField()
    date = serializers.DateField()
    attendance = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        )
    )
    marked_by = serializers.IntegerField()
    
    def validate_attendance(self, value):
        """Validate attendance list format"""
        for item in value:
            if 'student_id' not in item or 'status' not in item:
                raise serializers.ValidationError(
                    "Each attendance item must have 'student_id' and 'status'"
                )
            if item['status'] not in ['P', 'A', 'L', 'E']:
                raise serializers.ValidationError(
                    "Status must be one of: P (Present), A (Absent), L (Late), E (Excused)"
                )
        return value


class AttendanceSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for attendance submissions"""
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    class_name = serializers.CharField(source='class_session.name', read_only=True)
    submission_time = serializers.ReadOnlyField()
    attendance_percentage = serializers.ReadOnlyField()
    
    class Meta:
        model = AttendanceSubmission
        fields = [
            'id', 'teacher', 'teacher_name', 'class_session',
            'class_name', 'date', 'total_students', 'present_count',
            'absent_count', 'late_count', 'excused_count',
            'status', 'submitted_at', 'submission_time',
            'attendance_percentage', 'updated_at'
        ]
        read_only_fields = [
            'submitted_at', 'updated_at', 'submission_time',
            'attendance_percentage'
        ]


class AttendanceSummarySerializer(serializers.ModelSerializer):
    """Serializer for attendance summaries"""
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_admission_number = serializers.CharField(
        source='student.admission_number',
        read_only=True
    )
    
    class Meta:
        model = AttendanceSummary
        fields = [
            'id', 'student', 'student_name', 'student_admission_number',
            'month', 'year', 'total_days', 'present_days',
            'absent_days', 'late_days', 'excused_days',
            'attendance_percentage', 'created_at', 'updated_at'
        ]
        read_only_fields = ['attendance_percentage', 'created_at', 'updated_at']


class SystemStatusSerializer(serializers.ModelSerializer):
    """Serializer for system status"""
    
    class Meta:
        model = SystemStatus
        fields = [
            'id', 'status', 'message', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class FlaggedAbsenceSerializer(serializers.ModelSerializer):
    """Serializer for flagged absences"""
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_admission_number = serializers.CharField(
        source='student.admission_number',
        read_only=True
    )
    student_class = serializers.CharField(
        source='student.current_class.name',
        read_only=True
    )
    followed_up_by_name = serializers.CharField(
        source='followed_up_by.full_name',
        read_only=True
    )
    
    class Meta:
        model = FlaggedAbsence
        fields = [
            'id', 'student', 'student_name', 'student_admission_number',
            'student_class', 'consecutive_absences',
            'total_absences_this_month', 'attendance_percentage',
            'priority', 'reason', 'is_resolved', 'action_taken',
            'followed_up_by', 'followed_up_by_name', 'flagged_at',
            'resolved_at', 'updated_at'
        ]
        read_only_fields = ['flagged_at', 'resolved_at', 'updated_at']


# Dashboard-specific serializers

class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics"""
    total_students = serializers.IntegerField()
    students_change_percentage = serializers.FloatField(required=False)
    todays_attendance = serializers.DictField()
    active_classes = serializers.IntegerField()
    total_absentees_today = serializers.IntegerField()
    alert = serializers.BooleanField()


class AttendanceTrendSerializer(serializers.Serializer):
    """Serializer for attendance trends"""
    date = serializers.DateField()
    day = serializers.CharField()
    percentage = serializers.FloatField()


class ClassroomPerformanceSerializer(serializers.Serializer):
    """Serializer for classroom performance"""
    classroom = serializers.CharField()
    teacher = serializers.CharField()
    students = serializers.IntegerField()
    attendance_percentage = serializers.FloatField()
    status = serializers.CharField()


class RecentSubmissionSerializer(serializers.Serializer):
    """Serializer for recent attendance submissions"""
    teacher = serializers.CharField()
    class_name = serializers.CharField()
    submission_time = serializers.CharField()
    present = serializers.IntegerField()
    total = serializers.IntegerField()
    status = serializers.CharField()


class StaffPerformanceSerializer(serializers.Serializer):
    """Serializer for staff performance"""
    teacher = serializers.CharField()
    grade = serializers.CharField()
    submission_status = serializers.CharField()
    status = serializers.CharField()


class StudentStatisticsSerializer(serializers.Serializer):
    """Serializer for student statistics in list view"""
    total_active = serializers.IntegerField()
    avg_attendance = serializers.FloatField()
    birthdays_today = serializers.IntegerField()