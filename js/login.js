document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim().toLowerCase();
      const password = document.getElementById("password").value;

      // Lấy các hàm từ window (đã định nghĩa ở indexdangnhap.html)
      const { collection, getDocs, query, where, doc, getDoc } = window.dbFuncs;
      const db = window.db;
      const auth = window.firebaseAuth;

      try {
        // Bước 1: Xác thực mật khẩu qua Firebase Authentication (Cho cả Admin và User)
        const userCredential = await window.signIn(auth, email, password);
        const user = userCredential.user;

        // Bước 2: Phân quyền dựa trên Email
        if (email === "admin@gmail.com") {
          // --- KIỂM TRA QUYỀN ADMIN TRONG FIRESTORE ---
          // Chúng ta kiểm tra document có tên "admin@gmail.com" trong collection "user"
          const adminRef = doc(db, "user", email);
          const adminSnap = await getDoc(adminRef);

          if (adminSnap.exists() && adminSnap.data().role === "admin") {
            localStorage.setItem("userRole", "admin");
            localStorage.setItem("userEmail", email);
            alert("Xác nhận HLV Trưởng. Đang vào trang quản trị...");
            window.location.href = "indexchucnang.html";
          } else {
            alert(
              "Email này thuộc Admin nhưng chưa được phân quyền 'admin' trong Firestore!",
            );
          }
        } else {
          // --- TẤT CẢ EMAIL CÒN LẠI LÀ USER ---
          // Lưu thông tin và chuyển vào trang User
          localStorage.setItem("userRole", "user");
          localStorage.setItem("userEmail", email);

          // Thử lấy tên võ sĩ từ bảng 'vosi' nếu có (không bắt buộc)
          const qVosi = query(
            collection(db, "vosi"),
            where("email", "==", email),
          );
          const snapVosi = await getDocs(qVosi);

          if (!snapVosi.empty) {
            const data = snapVosi.docs[0].data();
            localStorage.setItem("userName", data.name);
            alert(`Chào võ sĩ ${data.name}! Đang vào sàn đấu...`);
          } else {
            alert("Chào mừng võ sĩ! Đang tải hồ sơ...");
          }

          window.location.href = "user.html";
        }
      } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        if (error.code === "auth/invalid-credential") {
          alert("Email hoặc mật khẩu không chính xác!");
        } else {
          alert("Lỗi: " + error.message);
        }
      }
    });
  }
});
