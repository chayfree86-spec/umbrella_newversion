<?php
/**
 * JWT Token Management (HMAC-SHA256, no external library)
 */
class JWT {

    public static function encode($payload) {
        $header = self::base64UrlEncode(json_encode([
            'alg' => 'HS256',
            'typ' => 'JWT'
        ]));

        $payload['iat'] = time();
        $payload['exp'] = time() + (JWT_EXPIRY_HOURS * 3600);
        $payloadEncoded = self::base64UrlEncode(json_encode($payload));

        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payloadEncoded", JWT_SECRET, true)
        );

        return "$header.$payloadEncoded.$signature";
    }

    public static function decode($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new Exception('Invalid token format', 401);
        }

        [$headerEncoded, $payloadEncoded, $signatureEncoded] = $parts;

        // Verify signature
        $expectedSignature = self::base64UrlEncode(
            hash_hmac('sha256', "$headerEncoded.$payloadEncoded", JWT_SECRET, true)
        );

        if (!hash_equals($expectedSignature, $signatureEncoded)) {
            throw new Exception('Invalid token signature', 401);
        }

        $payload = json_decode(self::base64UrlDecode($payloadEncoded), true);
        if (!$payload) {
            throw new Exception('Invalid token payload', 401);
        }

        // Check expiry
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            throw new Exception('Token has expired. Please login again.', 401);
        }

        return $payload;
    }

    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
