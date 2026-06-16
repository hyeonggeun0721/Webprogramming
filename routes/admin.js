const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs'); 

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// image 컬럼이 없다면 자동 추가 (이미 있으면 에러 무시됨)
db.run("ALTER TABLE products ADD COLUMN image TEXT DEFAULT 'default.png'", (err) => {});

// ==========================================
// [사진 폴더 자동 생성 및 Multer 설정]
// ==========================================
const uploadDir = path.join(__dirname, '../public/images');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("✅ public/images 폴더가 자동 생성되었습니다.");
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// [1. 관리자 메인 대시보드 (미처리 업무 요약)]
// ==========================================
router.get('/', (req, res) => {
    const user = req.session.user;
    
    if (!user || user.username !== 'admin') {
        // 💡 [/] -> [../] 상위 메인 홈으로 연동
        return res.send('<script>alert("관리자만 접근 가능합니다."); location.href="../";</script>');
    }

    // 1. 답변 대기 문의 수 (parent_id IS NULL 조건으로 원글만 카운트)
    const q1 = new Promise((resolve) => {
        db.get("SELECT COUNT(*) AS count FROM board WHERE status = '답변 대기' AND parent_id IS NULL", (err, row) => {
            resolve(row ? row.count : 0);
        });
    });

    // 2. 재고 부족 상품 수
    const q2 = new Promise((resolve) => {
        db.get("SELECT COUNT(*) AS count FROM products WHERE stock < 5", (err, row) => {
            resolve(row ? row.count : 0);
        });
    });

    // 3. 신규 주문 수
    const q3 = new Promise((resolve) => {
        db.get("SELECT COUNT(*) AS count FROM orders WHERE status = '결제완료'", (err, row) => {
            resolve(row ? row.count : 0);
        });
    });

    // 💡 4. 전체 주문 리스트 (+ 사진 매칭) 추가
    const q4 = new Promise((resolve) => {
        const sql = `
            SELECT o.*, p.image_url 
            FROM orders o 
            LEFT JOIN products p ON 
                TRIM(o.product_name) = TRIM(p.name) OR 
                o.product_name LIKE '%' || p.name || '%'
            ORDER BY o.id DESC
        `;
        db.all(sql, [], (err, orders) => {
            resolve(orders || []);
        });
    });

    Promise.all([q1, q2, q3, q4]).then((results) => {
        const [pendingBoard, lowStock, newOrders, orders] = results;
        
        res.render('admin', { 
            user: user,
            stats: { pendingBoard, lowStock, newOrders },
            orders: orders 
        });
    }).catch(err => {
        console.error(err);
        res.render('admin', { user: user, stats: { pendingBoard: 0, lowStock: 0, newOrders: 0 }, orders: [] });
    });
});

// ==========================================
// [2. 개별 관리 페이지 렌더링 라우터]
// ==========================================

// [2-1. 회원 관리 페이지 (+ 검색 기능)]
router.get('/users', (req, res) => {
    const user = req.session.user;
    // 💡 [/] -> [../] 상위 메인 홈 상대 경로 변경
    if (!user || user.username !== 'admin') return res.redirect('../');

    const searchKeyword = req.query.search || '';
    
    let sql = 'SELECT * FROM users ORDER BY id DESC';
    let params = [];

    if (searchKeyword) {
        sql = 'SELECT * FROM users WHERE username LIKE ? OR name LIKE ? ORDER BY id DESC';
        params = [`%${searchKeyword}%`, `%${searchKeyword}%`];
    }

    db.all(sql, params, (err, users) => {
        if (err) return res.send('회원 조회 실패');
        res.render('admin_users', { users: users, user: user, searchKeyword: searchKeyword });
    });
});

// [회원 상세 보기 페이지]
router.get('/user/view/:id', (req, res) => {
    const user = req.session.user;
    // 💡 [/] -> [../../../] 계층 깊이에 맞게 상위 홈 상대 경로 변경
    if (!user || user.username !== 'admin') return res.redirect('../../../');

    const targetId = req.params.id;

    db.get('SELECT * FROM users WHERE id = ?', [targetId], (err, targetUser) => {
        if (err || !targetUser) {
            return res.send('<script>alert("회원 정보를 찾을 수 없습니다."); history.back();</script>');
        }
        res.render('admin_user_view', { user: user, targetUser: targetUser });
    });
});

// 2-2. 주문 관리 페이지
router.get('/orders', (req, res) => {
    const user = req.session.user;
    // 💡 [/] -> [../] 상위 상대 경로 변경
    if (!user || user.username !== 'admin') return res.redirect('../');

    const sql = `
        SELECT o.*, p.image_url 
        FROM orders o 
        LEFT JOIN products p ON 
            TRIM(o.product_name) = TRIM(p.name) OR 
            o.product_name LIKE '%' || p.name || '%'
        ORDER BY o.id DESC
    `;

    db.all(sql, [], (err, orders) => {
        if (err) {
            console.error("관리자 주문 내역 조회 에러:", err.message);
            return res.status(500).send('주문 내역을 불러오는 중 오류가 발생했습니다.');
        }
        
        res.render('admin_orders', { user: user, orders: orders });
    });
});

// 2-3. 상품 관리 페이지
router.get('/products', (req, res) => {
    const user = req.session.user;
    // 💡 [/] -> [../] 상위 상대 경로 변경
    if (!user || user.username !== 'admin') return res.redirect('../');

    db.all('SELECT * FROM products ORDER BY id DESC', [], (err, products) => {
        if (err) return res.send('상품 조회 실패');
        res.render('admin_products', { products, user });
    });
});

// ==========================================
// [3. 관리자 기능 처리 (POST/Action)]
// ==========================================

// 회원 강제 탈퇴
router.post('/user/delete', (req, res) => {
    const user = req.session.user;
    // 💡 [/] -> [../] 상위 상대 경로 변경
    if (!user || user.username !== 'admin') return res.redirect('../');

    const targetUserId = req.body.userId;
    if (user.id == targetUserId) {
        // 💡 [/admin/users] -> [./users] 같은 레벨 상대 경로 매칭
        return res.send('<script>alert("관리자 계정은 삭제할 수 없습니다."); location.href="./users";</script>');
    }

    db.run('DELETE FROM users WHERE id = ?', [targetUserId], (err) => {
        // 💡 [/admin/users] -> [./users] 같은 레벨 상대 경로 매칭
        if (err) return res.send('<script>alert("회원 삭제에 실패했습니다."); location.href="./users";</script>');
        // 💡 [/admin/users] -> [./users] 리다이렉트 상대 경로 변경
        res.redirect('./users');
    });
});

// 주문 상태 변경
router.post('/order/status', (req, res) => {
    const user = req.session.user;
    
    // 💡 1. 권한이 없으면 무조건 메인(홈) 절대 경로로 이동
    if (!user || user.username !== 'admin') {
        return res.send('<script>alert("관리자 권한이 필요합니다."); location.href="/stud6/";</script>');
    }

    const { orderId, status } = req.body;
    
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], (err) => {
        // 💡 2. DB 에러 시 절대 경로로 되돌아가기
        if (err) {
            console.error("주문 상태 변경 에러:", err);
            return res.send('<script>alert("상태 변경에 실패했습니다."); location.href="/stud6/admin/orders";</script>');
        }
        
        // 💡 3. 불필요한 문자열 치환 로직 싹 지우고 절대 경로로 즉시 리다이렉트
        res.redirect('/stud6/admin/orders');
    });
});

// 주문 상세 보기
router.get('/order/view/:id', (req, res) => {
    const user = req.session.user;
    if (!user || user.username !== 'admin') {
        // 💡 [/] -> [../../../] 깊이 매칭 수정
        return res.status(403).send('<script>alert("접근 권한이 없습니다."); location.href="../../../";</script>');
    }

    const orderId = req.params.id;
    const query = `
        SELECT o.*, u.username, u.name, u.phone, u.address 
        FROM orders o 
        LEFT JOIN users u ON o.user_id = u.id 
        WHERE o.id = ?
    `;
    db.get(query, [orderId], (err, order) => {
        if (err || !order) {
            // 💡 [/admin/orders] -> [../../orders] 깊이 연동
            return res.send('<script>alert("주문 정보를 찾을 수 없습니다."); location.href="../../orders";</script>');
        }
        res.render('admin_order_view', { user, order });
    });
});

// 상품 추가
router.post('/product/add', (req, res) => {
    upload.single('image')(req, res, function (err) {
        if (err) {
            console.error("❌ 사진 업로드 에러:", err);
            return res.send('<script>alert("사진 저장 폴더 문제나 용량 문제로 업로드에 실패했습니다."); history.back();</script>');
        }

        const user = req.session.user;
        // 💡 [/] -> [../] 상위 상대 경로 변경
        if (!user || user.username !== 'admin') return res.redirect('../');

        const { name, category, price, description, stock } = req.body;
        
        console.log("✅ 전달받은 상품 정보:", name, category, price);
        console.log("✅ 저장된 사진 파일:", req.file ? req.file.filename : "사진 없음");

        const imageName = req.file ? req.file.filename : 'default.png';

        const sql = 'INSERT INTO products (name, category, price, description, image_url, stock) VALUES (?, ?, ?, ?, ?, ?)';
        
        db.run(sql, [name, category, price, description, imageName, stock || 10], (dbErr) => {
            if (dbErr) {
                console.error("❌ DB 저장 에러:", dbErr.message); 
                // 💡 [/admin/products] -> [./products] 변경
                return res.send(`<script>alert("상품 추가 실패: ${dbErr.message}"); location.href="./products";</script>`);
            }
            // 💡 리다이렉트 경로 변경
            res.redirect('./products');
        });
    });
});

// 상품 삭제
router.post('/product/delete', (req, res) => {
    const user = req.session.user;
    // 💡 [/] -> [../] 상위 상대 경로 변경
    if (!user || user.username !== 'admin') return res.redirect('../');

    const { productId } = req.body;
    
    db.run('DELETE FROM products WHERE id = ?', [productId], (err) => {
        if (err) {
            console.error("❌ 상품 삭제 에러:", err.message);
            // 💡 [/admin/products] -> [./products] 변경
            return res.send(`<script>alert("상품 삭제 실패: ${err.message}"); location.href="./products";</script>`);
        }
        // 💡 리다이렉트 변경
        res.redirect('./products');
    });
});

// 상품 추천 토글
router.post('/product/toggle-feature', (req, res) => {
    const user = req.session.user;
    // 💡 [/] -> [../] 상위 상대 경로 변경
    if (!user || user.username !== 'admin') return res.redirect('../');

    const { productId, isFeatured } = req.body;
    const newValue = isFeatured === '1' ? 1 : 0;

    db.run('UPDATE products SET is_featured = ? WHERE id = ?', [newValue, productId], (err) => {
        // 💡 [/admin/products] -> [./products] 변경
        if (err) return res.send('<script>alert("상태 변경 실패"); location.href="./products";</script>');
        res.redirect('./products');
    });
});

// 상품 정보 수정 처리
router.post('/product/update', (req, res) => {
    upload.single('image')(req, res, function (err) {
        if (err) {
            console.error("❌ 사진 업로드 에러:", err);
            return res.send('<script>alert("사진 업로드 중 오류가 발생했습니다."); history.back();</script>');
        }

        const user = req.session.user;
        // 💡 [/] -> [../] 상위 상대 경로 변경
        if (!user || user.username !== 'admin') return res.redirect('../');

        const { productId, name, category, price, description, stock, existingImage } = req.body;
        
        const imageName = req.file ? req.file.filename : existingImage;

        const sql = 'UPDATE products SET name = ?, category = ?, price = ?, description = ?, image_url = ?, stock = ? WHERE id = ?';
        
        db.run(sql, [name, category, price, description, imageName, stock, productId], (dbErr) => {
            if (dbErr) {
                console.error("❌ DB 수정 에러:", dbErr.message); 
                // 💡 [/admin/products] -> [./products] 변경
                return res.send(`<script>alert("상품 수정 실패: ${dbErr.message}"); location.href="./products";</script>`);
            }
            res.redirect('./products');
        });
    });
});

// ==========================================
// [4. 공지사항 관리 (수정/삭제)]
// ==========================================
router.get('/notice/edit/:id', (req, res) => {
    const user = req.session.user;
    // 💡 [/] -> [../../../] 깊이 변경
    if (!user || user.username !== 'admin') return res.redirect('../../../');

    const { id } = req.params;
    db.get('SELECT * FROM notices WHERE id = ?', [id], (err, row) => {
        // 💡 [/notice] -> [../../../notice] 상위 계층 공지사항 루트 연동
        if (err || !row) return res.send('<script>alert("글을 찾을 수 없습니다."); location.href="../../../notice";</script>');
        res.render('notice_edit', { notice: row, user });
    });
});

router.post('/notice/update', (req, res) => {
    const user = req.session.user;
    // 💡 [/] -> [../] 상위 상대 경로 변경
    if (!user || user.username !== 'admin') return res.redirect('../');

    const { id, title, content } = req.body;
    db.run('UPDATE notices SET title = ?, content = ? WHERE id = ?', [title, content, id], (err) => {
        if (err) return res.send('<script>alert("수정 실패"); history.back();</script>');
        // 💡 [/notice] -> [../../notice] 대입
        res.send('<script>alert("수정되었습니다."); location.href="../../notice";</script>');
    });
});

router.get('/notice/delete/:id', (req, res) => {
    const user = req.session.user;
    if (!user || user.username !== 'admin') {
        // 💡 [/notice] -> [../../../notice] 대입
        return res.send('<script>alert("권한이 없습니다."); location.href="../../../notice";</script>');
    }

    const { id } = req.params;
    db.run('DELETE FROM notices WHERE id = ?', [id], (err) => {
        if (err) return res.send('<script>alert("삭제 실패"); history.back();</script>');
        // 💡 [/notice] -> [../../../notice] 대입
        res.send('<script>alert("삭제되었습니다."); location.href="../../../notice";</script>');
    });
});

module.exports = router;