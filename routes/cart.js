const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// 테이블이 없을 경우 자동 생성
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        quantity INTEGER DEFAULT 1,
        UNIQUE(user_id, product_id)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_name TEXT,
        price INTEGER,
        quantity INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// 장바구니에 담기
router.post('/add', (req, res) => {
    const user = req.session.user;
    const productId = req.body.productId;

    if (!user) {
        return res.status(401).render('login_required', {
            message: '장바구니에 담기 위해서는 로그인이 필요합니다.',
            // 💡 [/user/login] -> [../user/login] 상대 경로 변경
            redirectUrl: '../user/login'
        });
    }

    const query = `INSERT INTO cart_items (user_id, product_id, quantity) 
                 VALUES (?, ?, 1) 
                 ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = quantity + 1`;

    db.run(query, [user.id, productId], function (err) {
        if (err) {
            console.error('장바구니 추가 에러:', err.message);
            return res.status(500).send('장바구니 추가 실패: ' + err.message);
        }
        // 💡 [/cart] -> [./] 상대 경로 리다이렉트 변경
        res.redirect('./');
    });
});

// 장바구니 목록 조회
router.get('/', (req, res) => {
    const user = req.session.user;
    // 💡 [/user/login] -> [../user/login] 상대 경로 변경
    if (!user) return res.redirect('./user/login');

    const query = `
    SELECT p.id, p.name, p.price, p.image_url, c.quantity
    FROM cart_items c
    JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?`;

    db.all(query, [user.id], (err, rows) => {
        if (err) {
            console.error('장바구니 조회 에러:', err.message);
            return res.status(500).send('장바구니 조회 실패');
        }
        res.render('cart', { cartItems: rows, user });
    });
});

// 장바구니 수량 조절
router.post('/update', (req, res) => {
    // 💡 [/user/login] -> [../user/login] 상대 경로 변경
    if (!req.session.user) return res.redirect('./user/login');
    
    const userId = req.session.user.id;
    const productId = req.body.productId;
    const action = req.body.action;

    db.get(`SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?`, [userId, productId], (err, row) => {
        if (err || !row) return res.status(500).send("조회 실패");

        let newQuantity = row.quantity;
        if (action === 'increase') newQuantity += 1;
        else if (action === 'decrease') newQuantity -= 1;

        if (newQuantity <= 0) {
            db.run(`DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`, [userId, productId], () => {
                // 💡 [/cart] -> [./] 상대 경로 리다이렉트 변경
                res.redirect('./');
            });
        } else {
            db.run(`UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?`, [newQuantity, userId, productId], () => {
                // 💡 [/cart] -> [./] 상대 경로 리다이렉트 변경
                res.redirect('./');
            });
        }
    });
});

// 장바구니 항목 삭제
router.post('/delete', (req, res) => {
    const user = req.session.user;
    const { productId } = req.body;

    // 💡 [/user/login] -> [../user/login] 상대 경로 변경
    if (!user) return res.redirect('./user/login');

    const deleteQuery = `DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`;
    db.run(deleteQuery, [user.id, productId], (err) => {
        if (err) return res.status(500).send('삭제 실패');
        // 💡 [/cart] -> [./] 상대 경로 리다이렉트 변경
        res.redirect('./');
    });
});

// 1. [기존 코드 수정] 장바구니 -> 주문/결제(체크아웃) 페이지 이동
router.post('/checkout', (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect('../user/login');

    const checkedIds = req.body.checkedIds;

    if (!checkedIds || checkedIds.trim() === "") {
        return res.send('<script>alert("선택된 상품이 없습니다."); history.back();</script>');
    }

    const idsArray = checkedIds.split(',').map(id => parseInt(id.trim()));
    const placeholders = idsArray.map(() => '?').join(',');

    const selectQuery = `
        SELECT p.id, p.name, p.price, p.stock, c.quantity
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ? AND c.product_id IN (${placeholders})
    `;

    const params = [user.id, ...idsArray];

    db.all(selectQuery, params, (err, items) => {
        if (err || items.length === 0) {
            return res.send('<script>alert("상품 정보를 찾을 수 없습니다."); history.back();</script>');
        }
        
        // 🛑 결제 처리는 밑으로 넘기고, 여기서는 주문서 페이지(checkout.ejs)를 띄워줍니다.
        res.render('checkout', { items, checkedIds, user });
    });
});

// 2. [신규 추가] 체크아웃 화면에서 '최종 결제하기' 버튼을 눌렀을 때 실제 DB 처리
router.post('/process', (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect('../user/login');

    const { checkedIds, phone, address, memo } = req.body;
    
    // 💡 기존 checkout에 있던 재고 확인, 주문 생성, 장바구니 비우기, 적립금 지급 로직을 여기에 그대로 옮겨 담으시면 됩니다.
    // (이후 res.send(`<script>alert("결제 완료!"); location.href="/user/orders";</script>`); 실행)
});

module.exports = router;