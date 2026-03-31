document.addEventListener("DOMContentLoaded", () => {
  const regForm = document.getElementById("registerForm");

  if (regForm) {
    regForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const email = document.getElementById("reg-email").value;
      const password = document.getElementById("reg-password").value;
      const confirmPass = document.getElementById("confirm-password").value;

      if (password !== confirmPass) {
        alert("Mật khẩu xác nhận không khớp!");
        return;
      }

      if (password.length < 6) {
        alert("Mật khẩu phải có ít nhất 6 ký tự!");
        return;
      }

      // Gọi hàm Firebase từ window (do đã định nghĩa ở thẻ script module)
      window
        .createUser(window.firebaseAuth, email, password)
        .then((userCredential) => {
          alert("Gia nhập đội thành công!");
          window.location.href = "dangnhap.html";
        })
        .catch((error) => {
          const errorCode = error.code;
          if (errorCode === "auth/email-already-in-use") {
            alert("Email này đã được sử dụng!");
          } else {
            alert("Lỗi: " + error.message);
          }
        });
    });
  }
});
