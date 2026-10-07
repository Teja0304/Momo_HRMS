-- CreateTable
CREATE TABLE `attendance_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(64) NOT NULL,
    `office_id` VARCHAR(64) NOT NULL,
    `attendance_date` DATE NOT NULL,
    `status` ENUM('WORKING', 'PAUSED', 'CHECKED_OUT') NOT NULL DEFAULT 'WORKING',
    `check_in_at` DATETIME(3) NOT NULL,
    `check_out_at` DATETIME(3) NULL,
    `check_in_status` ENUM('ON_TIME', 'LATE', 'EXCEPTION') NOT NULL,
    `current_pause_started_at` DATETIME(3) NULL,
    `current_grace_deadline` DATETIME(3) NULL,
    `checkoutType` ENUM('MANUAL', 'AUTO', 'ADMIN') NULL,
    `checkout_reason` ENUM('USER_CHECKOUT', 'GEOFENCE_TIMEOUT', 'ADMIN_ACTION', 'SYSTEM_ACTION') NULL,
    `total_working_seconds` INTEGER NOT NULL DEFAULT 0,
    `reopen_reason` VARCHAR(255) NULL,
    `reopen_authorized_by` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_sessions_employee_id_idx`(`employee_id`),
    INDEX `attendance_sessions_attendance_date_idx`(`attendance_date`),
    INDEX `attendance_sessions_status_idx`(`status`),
    INDEX `attendance_sessions_current_grace_deadline_idx`(`current_grace_deadline`),
    INDEX `attendance_sessions_employee_id_attendance_date_idx`(`employee_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_pauses` (
    `id` VARCHAR(191) NOT NULL,
    `attendance_session_id` VARCHAR(191) NOT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `ended_at` DATETIME(3) NULL,
    `duration_seconds` INTEGER NULL,
    `grace_deadline` DATETIME(3) NOT NULL,
    `end_reason` ENUM('RETURNED', 'AUTO_CHECKOUT') NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_pauses_attendance_session_id_idx`(`attendance_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_events` (
    `id` VARCHAR(191) NOT NULL,
    `attendance_session_id` VARCHAR(191) NULL,
    `employee_id` VARCHAR(64) NOT NULL,
    `client_event_id` VARCHAR(128) NOT NULL,
    `event_type` ENUM('CHECK_IN', 'GEOFENCE_EXIT', 'GEOFENCE_RETURN', 'CHECK_OUT', 'AUTO_CHECKOUT', 'ATTENDANCE_REJECTED') NOT NULL,
    `event_time` DATETIME(3) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `altitude_meters` DOUBLE NULL,
    `accuracy_meters` DOUBLE NULL,
    `source` ENUM('ONLINE', 'OFFLINE_SYNC', 'SYSTEM', 'ADMIN') NOT NULL DEFAULT 'ONLINE',
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attendance_events_client_event_id_key`(`client_event_id`),
    INDEX `attendance_events_attendance_session_id_idx`(`attendance_session_id`),
    INDEX `attendance_events_employee_id_idx`(`employee_id`),
    INDEX `attendance_events_event_time_idx`(`event_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_attendance_locks` (
    `employee_id` VARCHAR(64) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`employee_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendance_pauses` ADD CONSTRAINT `attendance_pauses_attendance_session_id_fkey` FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_events` ADD CONSTRAINT `attendance_events_attendance_session_id_fkey` FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
