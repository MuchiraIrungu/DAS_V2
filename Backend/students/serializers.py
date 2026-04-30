# Backend/students/serializers.py

from rest_framework import serializers
from .models import User, School, Class, Student, Teacher, Grade, Term, Subject, PerformanceRecord


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model.

    `school` / `school_name` expose the user's resolved school — present for
    both admins (headteachers) and teachers so the frontend always knows which
    school's data it is working with.

    `teacher_profile_data` is populated only when the user has a teacher_profile.
    """
    full_name = serializers.ReadOnlyField()
    school_name = serializers.SerializerMethodField()
    teacher_profile_data = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'role', 'phone', 'photo', 'is_active',
            'date_joined',
            'school',           # FK id — writable; set at account creation
            'school_name',      # human-readable label — read-only
            'teacher_profile_data',
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'school': {'required': False, 'allow_null': True},
        }

    def get_school_name(self, obj):
        """
        Return the school name regardless of how school is resolved
        (explicit FK or via teacher → classes chain).
        """
        # Explicit FK is fastest
        if obj.school_id:
            return obj.school.name

        # Teacher fallback
        if obj.role == 'teacher':
            try:
                first_class = obj.teacher_profile.classes.select_related('school').first()
                return first_class.school.name if first_class else None
            except Exception:
                return None

        return None

    def get_teacher_profile_data(self, obj):
        """
        Return teacher-specific data when the user has a teacher_profile.
        Chain: User → Teacher → classes (M2M) → school (FK)
        """
        try:
            teacher = obj.teacher_profile
        except Exception:
            return None

        classes_qs = teacher.classes.select_related('school').all()

        # School: prefer explicit user.school, fall back to first class
        if obj.school_id:
            school = obj.school
        else:
            first_class = classes_qs.first()
            school = first_class.school if first_class else None

        return {
            'teacher_id': teacher.id,
            'employee_id': teacher.employee_id,
            'subject_specialization': teacher.subject_specialization,
            'classes': [
                {
                    'id': c.id,
                    'name': c.name,
                    'grade_level': c.grade_level,
                    'section': c.section,
                }
                for c in classes_qs
            ],
            'school': {'id': school.id, 'name': school.name} if school else None,
        }

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = [
            'id', 'name', 'code', 'address', 'phone',
            'email', 'logo', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class ClassSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField(source='get_display_name')
    student_count = serializers.ReadOnlyField()
    school_name = serializers.CharField(source='school.name', read_only=True)
    class_teacher_name = serializers.CharField(source='class_teacher.full_name', read_only=True)

    class Meta:
        model = Class
        fields = [
            'id', 'name', 'display_name', 'grade_level', 'section',
            'nickname', 'academic_year', 'school', 'school_name',
            'class_teacher', 'class_teacher_name', 'student_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'student_count']


class StudentListSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    class_name = serializers.CharField(source='current_class.name', read_only=True)
    age = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = [
            'id', 'admission_number', 'full_name', 'first_name',
            'last_name', 'email', 'photo', 'status', 'class_name',
            'current_class', 'age', 'parent_name', 'parent_phone'
        ]


class StudentDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    is_birthday_today = serializers.ReadOnlyField()
    class_name = serializers.CharField(source='current_class.name', read_only=True)
    class_display_name = serializers.CharField(source='current_class.get_display_name', read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'admission_number', 'first_name', 'last_name',
            'full_name', 'email', 'photo', 'date_of_birth', 'age',
            'gender', 'status', 'is_active', 'current_class',
            'class_name', 'class_display_name', 'parent_name',
            'parent_phone', 'parent_email', 'address',
            'enrollment_date', 'is_birthday_today', 'user',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'age', 'is_birthday_today']


class StudentCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            'id', 'admission_number', 'first_name', 'last_name', 'email',
            'photo', 'date_of_birth', 'gender', 'status',
            'current_class', 'parent_name', 'parent_phone',
            'parent_email', 'address', 'enrollment_date', 'is_active'
        ]

    def validate_admission_number(self, value):
        instance = self.instance
        qs = Student.objects.filter(admission_number=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A student with this admission number already exists.")
        return value


class TeacherListSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    assigned_classes_count = serializers.ReadOnlyField()

    class Meta:
        model = Teacher
        fields = [
            'id', 'employee_id', 'full_name', 'first_name',
            'last_name', 'email', 'phone', 'photo',
            'subject_specialization', 'assigned_classes_count',
            'is_active'
        ]


class TeacherDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    assigned_classes_count = serializers.ReadOnlyField()
    classes_detail = ClassSerializer(source='classes', many=True, read_only=True)
    main_class = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            'id', 'employee_id', 'first_name', 'last_name',
            'full_name', 'email', 'phone', 'photo',
            'subject_specialization', 'classes', 'classes_detail',
            'assigned_classes_count', 'main_class', 'user',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'assigned_classes_count']

    def get_main_class(self, obj):
        main_class = obj.get_main_class()
        return ClassSerializer(main_class).data if main_class else None


class TeacherCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = [
            'employee_id', 'first_name', 'last_name', 'email',
            'phone', 'photo', 'subject_specialization',
            'classes', 'user', 'is_active'
        ]

    def validate_employee_id(self, value):
        instance = self.instance
        qs = Teacher.objects.filter(employee_id=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A teacher with this employee ID already exists.")
        return value

    def validate_email(self, value):
        instance = self.instance
        qs = Teacher.objects.filter(email=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A teacher with this email already exists.")
        return value


# ==================== GRADE SERIALIZERS ====================

class GradeSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    terms_count = serializers.SerializerMethodField()
    subjects_count = serializers.SerializerMethodField()

    class Meta:
        model = Grade
        fields = [
            'id', 'name', 'level', 'school_year', 'school',
            'school_name', 'description', 'is_active',
            'terms_count', 'subjects_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_terms_count(self, obj):
        return obj.terms.count()

    def get_subjects_count(self, obj):
        return obj.subjects.count()


class GradeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ['id', 'name', 'level', 'school_year', 'is_active']


# ==================== TERM SERIALIZERS ====================

class TermSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    duration_days = serializers.ReadOnlyField()
    is_current = serializers.ReadOnlyField()
    subjects_count = serializers.SerializerMethodField()

    class Meta:
        model = Term
        fields = [
            'id', 'name', 'term_type', 'term_number',
            'grade', 'grade_name', 'start_date', 'end_date',
            'duration_days', 'is_current', 'is_active',
            'subjects_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_subjects_count(self, obj):
        return obj.subjects.count()

    def validate(self, data):
        if data.get('end_date') and data.get('start_date'):
            if data['end_date'] <= data['start_date']:
                raise serializers.ValidationError("End date must be after start date")
        return data


class TermListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ['id', 'name', 'term_number', 'start_date', 'end_date', 'is_current', 'is_active']


# ==================== SUBJECT SERIALIZERS ====================

class SubjectSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    term_name = serializers.CharField(source='term.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)

    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'code', 'grade', 'grade_name',
            'term', 'term_name', 'teacher', 'teacher_name',
            'description', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_code(self, value):
        instance = self.instance
        qs = Subject.objects.filter(code=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A subject with this code already exists.")
        return value


class SubjectListSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)

    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'teacher', 'teacher_name', 'is_active']


# ==================== PERFORMANCE SERIALIZERS ====================

class PerformanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_admission = serializers.CharField(source='student.admission_number', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    term_name = serializers.CharField(source='term.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = PerformanceRecord
        fields = [
            'id', 'student', 'student_name', 'student_admission',
            'subject', 'subject_name', 'subject_code',
            'term', 'term_name', 'score', 'grade',
            'comments', 'attendance_percentage', 'low_attendance_flag',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'low_attendance_flag', 'grade']

    def validate_score(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Score must be between 0 and 100")
        return value


class PerformanceRecordCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceRecord
        fields = ['student', 'subject', 'term', 'score', 'comments', 'attendance_percentage', 'created_by']

    def create(self, validated_data):
        return super().create(validated_data)


class PerformanceRecordListSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = PerformanceRecord
        fields = ['id', 'student', 'student_name', 'subject', 'subject_name', 'score', 'grade', 'low_attendance_flag']


class StudentPerformanceSummarySerializer(serializers.Serializer):
    student = serializers.IntegerField()
    student_name = serializers.CharField()
    term = serializers.IntegerField()
    term_name = serializers.CharField()
    average_score = serializers.DecimalField(max_digits=5, decimal_places=2)
    average_grade = serializers.CharField()
    subjects_count = serializers.IntegerField()
    low_attendance_subjects = serializers.IntegerField()
    overall_attendance = serializers.DecimalField(max_digits=5, decimal_places=2)


# ==================== QR CODE SERIALIZER ====================

class StudentQRCodeSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    admission_number = serializers.CharField()
    full_name = serializers.CharField()
    qr_code_data = serializers.CharField()
    qr_code_image_url = serializers.URLField(required=False, allow_null=True)