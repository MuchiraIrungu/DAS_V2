# Backend/students/admin.py
# Updated admin configuration

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from .models import User, School, Class, Student, Teacher


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'role', 'full_name', 'photo_thumbnail', 'is_staff', 'is_active']
    list_filter = ['role', 'is_staff', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info', {
            'fields': ('role', 'phone', 'photo')
        }),
    )
    
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Additional Info', {
            'fields': ('role', 'phone', 'photo')
        }),
    )
    
    def photo_thumbnail(self, obj):
        if obj.photo:
            return format_html('<img src="{}" width="50" height="50" style="border-radius: 50%;" />', obj.photo.url)
        return "No photo"
    photo_thumbnail.short_description = 'Photo'


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'phone', 'email', 'created_at']
    search_fields = ['name', 'code', 'email']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ['name', 'nickname', 'grade_level', 'section', 'academic_year', 'class_teacher', 'student_count', 'school']
    list_filter = ['grade_level', 'academic_year', 'school']
    search_fields = ['name', 'nickname']
    readonly_fields = ['created_at', 'updated_at', 'student_count']
    
    def student_count(self, obj):
        return obj.student_count
    student_count.short_description = 'Students'


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = [
        'admission_number', 
        'full_name', 
        'photo_thumbnail',
        'email',
        'current_class', 
        'status',
        'is_birthday_today_display',
        'enrollment_date'
    ]
    list_filter = ['current_class', 'status', 'gender', 'enrollment_date']
    search_fields = ['admission_number', 'first_name', 'last_name', 'email', 'parent_name', 'parent_phone']
    readonly_fields = ['created_at', 'updated_at', 'age', 'is_birthday_today']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('admission_number', 'first_name', 'last_name', 'email', 'photo', 'date_of_birth', 'gender')
        }),
        ('Status', {
            'fields': ('status', 'is_active', 'current_class')
        }),
        ('Parent/Guardian Information', {
            'fields': ('parent_name', 'parent_phone', 'parent_email', 'address')
        }),
        ('Dates', {
            'fields': ('enrollment_date', 'age', 'is_birthday_today')
        }),
        ('System', {
            'fields': ('user', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def photo_thumbnail(self, obj):
        if obj.photo:
            return format_html('<img src="{}" width="50" height="50" style="border-radius: 50%;" />', obj.photo.url)
        return "No photo"
    photo_thumbnail.short_description = 'Photo'
    
    def is_birthday_today_display(self, obj):
        if obj.is_birthday_today:
            return format_html('<span style="color: green;">🎂 Yes</span>')
        return "No"
    is_birthday_today_display.short_description = 'Birthday Today'


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = [
        'employee_id', 
        'full_name',
        'photo_thumbnail',
        'email', 
        'phone',
        'assigned_classes_count',
        'is_active'
    ]
    list_filter = ['is_active', 'subject_specialization']
    search_fields = ['employee_id', 'first_name', 'last_name', 'email']
    filter_horizontal = ['classes']
    readonly_fields = ['created_at', 'updated_at', 'assigned_classes_count']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('employee_id', 'first_name', 'last_name', 'email', 'phone', 'photo')
        }),
        ('Professional Information', {
            'fields': ('subject_specialization', 'classes', 'assigned_classes_count')
        }),
        ('Account', {
            'fields': ('user', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def photo_thumbnail(self, obj):
        if obj.photo:
            return format_html('<img src="{}" width="50" height="50" style="border-radius: 50%;" />', obj.photo.url)
        return "No photo"
    photo_thumbnail.short_description = 'Photo'

