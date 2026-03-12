<?php
header("Content-Type: application/json");
include 'db_config.php';

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);

    if ($action === 'register') {
        $mobile = $conn->real_escape_string($data['mobile']);
        $password = $conn->real_escape_string($data['password']);
        $username = "User" . substr($mobile, -4);

        // Check if exists
        $check = $conn->query("SELECT id FROM users WHERE mobile = '$mobile'");
        if ($check->num_rows > 0) {
            echo json_encode(["success" => false, "message" => "User already exists!"]);
            exit;
        }

        $sql = "INSERT INTO users (mobile, password, username, kyc, credit_score, vip, balance, invested) 
                VALUES ('$mobile', '$password', '$username', 'Pending', 100, 0, 0.00, 0.00)";

        if ($conn->query($sql)) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
    }

    if ($action === 'login') {
        $mobile = $conn->real_escape_string($data['mobile']);
        $password = $conn->real_escape_string($data['password']);

        $result = $conn->query("SELECT * FROM users WHERE mobile = '$mobile' AND password = '$password'");
        if ($result->num_rows > 0) {
            $user = $result->fetch_assoc();
            // Map keys to match frontend expectation
            $user['creditScore'] = intval($user['credit_score']);
            $user['invested'] = floatval($user['invested']);
            $user['balance'] = floatval($user['balance']);
            $user['vip'] = intval($user['vip']);
            echo json_encode(["success" => true, "user" => $user]);
        } else {
            echo json_encode(["success" => false, "message" => "Invalid mobile or password!"]);
        }
    }

    if ($action === 'resetPassword') {
        $mobile = $conn->real_escape_string($data['mobile']);
        $newPassword = $conn->real_escape_string($data['newPassword']);

        $sql = "UPDATE users SET password = '$newPassword' WHERE mobile = '$mobile'";
        if ($conn->query($sql) && $conn->affected_rows > 0) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "message" => "Mobile number not found!"]);
        }
    }
    if ($action === 'sendMessage') {
        $userId = intval($data['userId']);
        $message = $conn->real_escape_string($data['message']);

        $sql = "INSERT INTO messages (user_id, message, sender) VALUES ($userId, '$message', 'User')";
        if ($conn->query($sql)) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
    }

    if ($action === 'getMessages') {
        $userId = intval($data['userId']);
        $result = $conn->query("SELECT * FROM messages WHERE user_id = $userId ORDER BY created_at ASC");
        $messages = [];
        while ($row = $result->fetch_assoc()) {
            $messages[] = $row;
        }
        echo json_encode($messages);
    }

    if ($action === 'adminLogin') {
        $username = $conn->real_escape_string($data['username']);
        $password = $conn->real_escape_string($data['password']);

        $result = $conn->query("SELECT * FROM admins WHERE username = '$username' AND password = '$password'");
        if ($result->num_rows > 0) {
            $admin = $result->fetch_assoc();
            echo json_encode(["success" => true, "admin" => $admin]);
        } else {
            echo json_encode(["success" => false, "message" => "Invalid admin credentials!"]);
        }
    }

    if ($action === 'getKycUsers') {
        $result = $conn->query("SELECT * FROM users ORDER BY created_at DESC");
        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
        echo json_encode(["success" => true, "users" => $users]);
    }

    if ($action === 'deleteUser') {
        $userId = intval($data['userId']);
        // First delete related records to avoid foreign key constraints
        $conn->query("DELETE FROM deposits WHERE user_id = $userId");
        $conn->query("DELETE FROM withdrawals WHERE user_id = $userId");
        $conn->query("DELETE FROM messages WHERE user_id = $userId");

        $sql = "DELETE FROM users WHERE id = $userId";
        if ($conn->query($sql)) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
    }

    if ($action === 'bulkDeleteUsers') {
        $userIds = $data['userIds']; // Array of IDs
        if (empty($userIds)) {
            echo json_encode(["success" => false, "message" => "No users selected"]);
            exit;
        }

        $idsString = implode(',', array_map('intval', $userIds));

        // Delete related records
        $conn->query("DELETE FROM deposits WHERE user_id IN ($idsString)");
        $conn->query("DELETE FROM withdrawals WHERE user_id IN ($idsString)");
        $conn->query("DELETE FROM messages WHERE user_id IN ($idsString)");

        $sql = "DELETE FROM users WHERE id IN ($idsString)";
        if ($conn->query($sql)) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
    }

    if ($action === 'updateKycStatus') {
        $userId = intval($data['userId']);
        $status = $conn->real_escape_string($data['status']);
        $notes = $conn->real_escape_string($data['notes']);

        $sql = "UPDATE users SET kyc = '$status', notes = '$notes' WHERE id = $userId";
        if ($conn->query($sql)) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
    }
}
$conn->close();
