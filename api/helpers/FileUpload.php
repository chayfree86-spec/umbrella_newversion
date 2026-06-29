<?php
/**
 * Secure File Upload Handler
 */
class FileUpload {

    public static function upload($file, $subDir = 'documents') {
        // Validate file exists
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            throw new Exception('No valid file uploaded.', 400);
        }

        // Check file size
        if ($file['size'] > MAX_FILE_SIZE) {
            throw new Exception('File size exceeds maximum limit of ' . (MAX_FILE_SIZE / 1024 / 1024) . 'MB.', 400);
        }

        // Check file extension
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_FILE_TYPES)) {
            throw new Exception('File type not allowed. Allowed: ' . implode(', ', ALLOWED_FILE_TYPES), 400);
        }

        // Check MIME type
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);
        if (!in_array($mimeType, ALLOWED_MIME_TYPES)) {
            throw new Exception('Invalid file MIME type.', 400);
        }

        // Create directory if not exists
        $targetDir = UPLOAD_DIR . $subDir . '/';
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0755, true);
        }

        // Generate unique filename
        $filename = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $targetPath = $targetDir . $filename;

        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            throw new Exception('Failed to save uploaded file.', 500);
        }

        // Return relative path for storage
        return 'uploads/' . $subDir . '/' . $filename;
    }

    public static function uploadMultiple($files, $subDir = 'documents') {
        $paths = [];
        if (!is_array($files['tmp_name'])) {
            $paths[] = self::upload($files, $subDir);
        } else {
            for ($i = 0; $i < count($files['tmp_name']); $i++) {
                $file = [
                    'name' => $files['name'][$i],
                    'tmp_name' => $files['tmp_name'][$i],
                    'size' => $files['size'][$i],
                    'type' => $files['type'][$i],
                    'error' => $files['error'][$i]
                ];
                if ($file['error'] === UPLOAD_ERR_OK) {
                    $paths[] = self::upload($file, $subDir);
                }
            }
        }
        return $paths;
    }
}
