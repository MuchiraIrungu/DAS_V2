
# Backend/attendance/admin.py
# Updated attendance admin configuration

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    AttendanceRecord, 
    AttendanceSubmission, 
    AttendanceSummary,
    SystemStatus,
    FlaggedAbsence
)


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = [
        'student', 
        'date', 
        'status_badge',
        'class_session', 
        'marked_by',
        'created_at'
    ]
    list_filter = ['status', 'date', 'class_session']
    search_fields = [
        'student__first_name', 
        'student__last_name', 
        'student__admission_number'
    ]
    date_hierarchy = 'date'
    readonly_fields = ['created_at', 'updated_at']
    
    def status_badge(self, obj):
        colors = {
            'P': 'green',
            'A': 'red',
            'L': 'orange',
            'E': 'blue'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            colors.get(obj.status, 'gray'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(AttendanceSubmission)
class AttendanceSubmissionAdmin(admin.ModelAdmin):
    list_display = [
        'teacher',
        'class_session',
        'date',
        'submission_time',
        'present_absent_display',
        'attendance_percentage',
        'status_badge'
    ]
    list_filter = ['status', 'date', 'class_session']
    search_fields = ['teacher__first_name', 'teacher__last_name', 'class_session__name']
    readonly_fields = [
        'submitted_at', 
        'updated_at', 
        'submission_time',
        'attendance_percentage'
    ]
    date_hierarchy = 'date'
    
    def present_absent_display(self, obj):
        return f"{obj.present_count}/{obj.total_students}"
    present_absent_display.short_description = 'Present/Total'
    
    def status_badge(self, obj):
        colors = {
            'completed': 'green',
            'pending': 'orange'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            colors.get(obj.status, 'gray'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(AttendanceSummary)
class AttendanceSummaryAdmin(admin.ModelAdmin):
    list_display = [
        'student', 
        'month', 
        'year', 
        'present_days',
        'absent_days',
        'total_days', 
        'attendance_percentage_display'
    ]
    list_filter = ['month', 'year']
    search_fields = ['student__first_name', 'student__last_name']
    readonly_fields = ['attendance_percentage', 'created_at', 'updated_at']
    
    actions = ['recalculate_summaries']
    
    def attendance_percentage_display(self, obj):
        percentage = float(obj.attendance_percentage)
        if percentage >= 95:
            color = 'green'
        elif percentage >= 85:
            color = 'orange'
        else:
            color = 'red'
        return format_html(
            '<span style="color: {}; font-weight: bold;">{:.2f}%</span>',
            color,
            percentage
        )
    attendance_percentage_display.short_description = 'Attendance %'
    
    def recalculate_summaries(self, request, queryset):
        for summary in queryset:
            summary.recalculate_from_records()
        self.message_user(request, f"Recalculated {queryset.count()} summaries.")
    recalculate_summaries.short_description = "Recalculate selected summaries"


@admin.register(SystemStatus)
class SystemStatusAdmin(admin.ModelAdmin):
    list_display = ['status_display', 'message', 'is_active', 'updated_at']
    list_filter = ['status', 'is_active']
    readonly_fields = ['created_at', 'updated_at']
    
    def status_display(self, obj):
        colors = {
            'operational': 'green',
            'degraded': 'orange',
            'maintenance': 'blue',
            'down': 'red'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            colors.get(obj.status, 'gray'),
            obj.get_status_display()
        )
    status_display.short_description = 'Status'


@admin.register(FlaggedAbsence)
class FlaggedAbsenceAdmin(admin.ModelAdmin):
    list_display = [
        'student',
        'priority_badge',
        'consecutive_absences',
        'attendance_percentage',
        'is_resolved',
        'flagged_at'
    ]
    list_filter = ['priority', 'is_resolved', 'flagged_at']
    search_fields = ['student__first_name', 'student__last_name', 'student__admission_number']
    readonly_fields = ['flagged_at', 'resolved_at', 'updated_at']
    
    fieldsets = (
        ('Student Information', {
            'fields': ('student',)
        }),
        ('Absence Details', {
            'fields': (
                'consecutive_absences',
                'total_absences_this_month',
                'attendance_percentage'
            )
        }),
        ('Flag Information', {
            'fields': ('priority', 'reason', 'is_resolved')
        }),
        ('Follow-up', {
            'fields': ('action_taken', 'followed_up_by')
        }),
        ('Timestamps', {
            'fields': ('flagged_at', 'resolved_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['mark_as_resolved']
    
    def priority_badge(self, obj):
        colors = {
            'low': '#90EE90',
            'medium': 'orange',
            'high': '#FF6347',
            'critical': 'red'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px; font-weight: bold;">{}</span>',
            colors.get(obj.priority, 'gray'),
            obj.get_priority_display()
        )
    priority_badge.short_description = 'Priority'
    
    def mark_as_resolved(self, request, queryset):
        count = queryset.update(is_resolved=True)
        self.message_user(request, f"Marked {count} absences as resolved.")
    mark_as_resolved.short_description = "Mark selected as resolved"