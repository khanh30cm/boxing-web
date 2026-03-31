document.addEventListener("DOMContentLoaded", () => {
  // 1. Khai báo các phần tử trên Header
  const authButtons = document.getElementById("auth-buttons");
  const userProfile = document.getElementById("user-profile");
  const logoutBtn = document.getElementById("logout-btn");
  const userNameText = document.getElementById("user-name-text");

  // 2. Lấy trạng thái đăng nhập từ trình duyệt (localStorage)
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  const userName = localStorage.getItem("userName");

  // 3. Kiểm tra và thay đổi giao diện Header
  if (isLoggedIn === "true") {
    // Nếu đã đăng nhập: Ẩn nút Login/Reg, Hiện Logo User
    if (authButtons) authButtons.style.display = "none";
    if (userProfile) userProfile.style.display = "flex"; // Dùng flex để căn chỉnh ảnh và chữ
    if (userNameText) userNameText.innerText = userName || "Võ Sĩ";
  } else {
    // Nếu chưa đăng nhập: Hiện nút Login/Reg, Ẩn Logo User
    if (authButtons) authButtons.style.display = "block";
    if (userProfile) userProfile.style.display = "none";
  }

  // 4. Xử lý sự kiện nút Đăng xuất (Thoát)
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Xóa dữ liệu đã lưu
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userName");

      alert("Bạn đã đăng xuất khỏi sàn đấu!");
      // Quay về trang chủ và tải lại trang để cập nhật menu
      window.location.href = "index.html";
    });
  }
});
