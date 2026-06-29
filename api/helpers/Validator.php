<?php
/**
 * Input Validation & Sanitization Helper
 */
class Validator {

    public static function sanitize($value) {
        if (is_string($value)) {
            return htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
        }
        return $value;
    }

    public static function sanitizeArray($data, $keys = null) {
        $clean = [];
        $source = $keys ? array_intersect_key($data, array_flip($keys)) : $data;
        foreach ($source as $key => $value) {
            $clean[$key] = is_string($value) ? self::sanitize($value) : $value;
        }
        return $clean;
    }

    public static function required($data, $fields) {
        $errors = [];
        foreach ($fields as $field) {
            if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                $errors[$field] = ucfirst(str_replace('_', ' ', $field)) . ' is required.';
            }
        }
        return $errors;
    }

    public static function email($value) {
        return filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function mobile($value) {
        return preg_match('/^[6-9]\d{9}$/', $value);
    }

    public static function decimal($value) {
        return is_numeric($value) && $value >= 0;
    }

    public static function pin($value) {
        return preg_match('/^\d{4}$/', $value);
    }

    public static function minLength($value, $min) {
        return strlen($value) >= $min;
    }

    public static function maxLength($value, $max) {
        return strlen($value) <= $max;
    }

    public static function inArray($value, $allowed) {
        return in_array($value, $allowed);
    }

    public static function date($value) {
        $d = \DateTime::createFromFormat('Y-m-d', $value);
        return $d && $d->format('Y-m-d') === $value;
    }

    public static function getPaginationParams() {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(MAX_PAGE_SIZE, max(1, (int)($_GET['per_page'] ?? DEFAULT_PAGE_SIZE)));
        $offset = ($page - 1) * $perPage;
        return [$page, $perPage, $offset];
    }

    public static function uuid() {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
