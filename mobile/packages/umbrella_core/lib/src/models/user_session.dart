/// Logged-in user snapshot — mirrors AuthController::login's
/// response.data.user shape exactly.
class UserSession {
  final int userId;
  final String name;
  final String mobile;
  final String? email;
  final String role;
  final String roleSlug;
  final int? branchId;
  final int? areaId;
  final int? agentId;
  final List<String> permissions;
  final bool canApproveAccounts;

  const UserSession({
    required this.userId,
    required this.name,
    required this.mobile,
    this.email,
    required this.role,
    required this.roleSlug,
    this.branchId,
    this.areaId,
    this.agentId,
    this.permissions = const [],
    this.canApproveAccounts = false,
  });

  bool can(String permission) => permissions.contains(permission);

  factory UserSession.fromJson(Map<String, dynamic> json) => UserSession(
        userId: _toInt(json['user_id'])!,
        name: json['name'] as String? ?? '',
        mobile: json['mobile'] as String? ?? '',
        email: json['email'] as String?,
        role: json['role'] as String? ?? '',
        roleSlug: json['role_slug'] as String? ?? '',
        branchId: _toInt(json['branch_id']),
        areaId: _toInt(json['area_id']),
        agentId: _toInt(json['agent_id']),
        permissions: (json['permissions'] as List?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        canApproveAccounts: json['can_approve_accounts'] == true,
      );

  Map<String, dynamic> toJson() => {
        'user_id': userId,
        'name': name,
        'mobile': mobile,
        'email': email,
        'role': role,
        'role_slug': roleSlug,
        'branch_id': branchId,
        'area_id': areaId,
        'agent_id': agentId,
        'permissions': permissions,
        'can_approve_accounts': canApproveAccounts,
      };

  static int? _toInt(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    return int.tryParse(v.toString());
  }
}
