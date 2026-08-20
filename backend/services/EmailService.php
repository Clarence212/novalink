<?php
// hey reader! email service for sending OTP verification codes and system notifications
require_once __DIR__ . '/../config/database.php';

class EmailService {
    private $pdo;
    private $config;

    public function __construct() {
        $this->pdo = getDbConnection();
        $this->config = require __DIR__ . '/../config/mail.php';
    }

    /**
     * Send OTP Verification email
     */
    public function sendOtpEmail($recipientEmail, $recipientName, $otpCode, $purpose = 'Account Registration') {
        $subject = "NovaLink OTP Verification Code - {$purpose}";
        $body = "
        <div style='font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 30px; rounded: 16px;'>
            <h2 style='color: #3b82f6;'>Novaville Homeowners Association, Inc.</h2>
            <p>Hi <strong>{$recipientName}</strong>,</p>
            <p>Your verification code for <strong>{$purpose}</strong> is:</p>
            <div style='background-color: #1e293b; border: 1px solid #334155; padding: 20px; text-align: center; border-radius: 12px; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #60a5fa; margin: 20px 0;'>
                {$otpCode}
            </div>
            <p style='font-size: 12px; color: #94a3b8;'>This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
        </div>";

        return $this->dispatchEmail($recipientEmail, $subject, $body, 'otp_verification');
    }

    /**
     * Broadcast announcement to residents
     */
    public function sendAnnouncementBroadcast($recipientEmail, $title, $content, $priority) {
        $subject = "NHAI Announcement [{$priority}]: {$title}";
        $body = "
        <div style='font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 30px;'>
            <h2 style='color: #3b82f6;'>Novaville HOA Announcement</h2>
            <h3 style='color: #e2e8f0;'>{$title}</h3>
            <p style='color: #cbd5e1; line-height: 1.6;'>{$content}</p>
            <hr style='border: 0; border-top: 1px solid #334155; margin: 20px 0;'>
            <p style='font-size: 11px; color: #64748b;'>Novaville Homeowners Association, Inc. Portal</p>
        </div>";

        return $this->dispatchEmail($recipientEmail, $subject, $body, 'announcement_broadcast');
    }

    /**
     * Internal email dispatch & log record creator
     */
    private function dispatchEmail($recipientEmail, $subject, $bodyHtml, $emailType) {
        // 1. Log notification in database
        $stmt = $this->pdo->prepare("
            INSERT INTO email_notifications (notification_id, recipient_email, subject, body_text, email_type, status, sent_at)
            VALUES (?, ?, ?, ?, ?, 'sent', NOW())
        ");
        $notificationId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        $stmt->execute([$notificationId, $recipientEmail, $subject, strip_tags($bodyHtml), $emailType]);

        // 2. Dispatch via PHP mail() with HTML headers
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: {$this->config['from_name']} <{$this->config['from_email']}>" . "\r\n";

        @mail($recipientEmail, $subject, $bodyHtml, $headers);

        return [
            'success' => true,
            'notification_id' => $notificationId,
            'to' => $recipientEmail,
            'subject' => $subject
        ];
    }
}
