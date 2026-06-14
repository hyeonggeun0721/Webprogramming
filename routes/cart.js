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
        res.redirect('./');
    });
});

// 장바구니 목록 조회
router.get('/', (req, res) => {
    const user = req.session.user;
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
                res.redirect('./');
            });
        } else {
            db.run(`UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?`, [newQuantity, userId, productId], () => {
                res.redirect('./');
            });
        }
    });
});

// 장바구니 항목 삭제
router.post('/delete', (req, res) => {
    const user = req.session.user;
    const { productId } = req.body;

    if (!user) return res.redirect('./user/login');

    const deleteQuery = `DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`;
    db.run(deleteQuery, [user.id, productId], (err) => {
        if (err) return res.status(500).send('삭제 실패');
        res.redirect('./');
    });
});

// 1. 장바구니에서 선택된 상품 정보를 받아 주문/결제(체크아웃) 페이지 렌더링
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
        if (err) {
            console.error("결제 DB 오류:", err.message);
            return res.send(`<script>alert("DB 조회 중 오류가 발생했습니다: ${err.message}"); history.back();</script>`);
        }

        if (items.length === 0) {
            return res.send('<script>alert("결제할 상품 정보를 찾을 수 없습니다."); location.href="./";</script>');
        }

        // 체크아웃 페이지 띄우기 (views/checkout.ejs 렌더링)
        res.render('checkout', { items, checkedIds, user });
    });
});

// 2. 체크아웃 페이지에서 '최종 결제하기' 폼 전송 시 실제 재고 차감 및 주문 처리
router.post('/process', (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect('../user/login');

    const { checkedIds, phone, address, memo } = req.body;

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
        if (err) {
            console.error("결제 DB 오류:", err.message);
            return res.send(`<script>alert("DB 조회 중 오류가 발생했습니다: ${err.message}"); history.back();</script>`);
        }

        if (items.length === 0) {
            return res.send('<script>alert("결제할 상품 정보를 찾을 수 없습니다."); location.href="./";</script>');
        }

        // 총 결제 금액 계산 및 재고 확인
        let grandTotal = 0;
        for (let item of items) {
            if (item.stock < item.quantity) {
                return res.send(`<script>alert("${item.name}의 재고가 부족합니다. (현재 재고: ${item.stock}개)"); location.href="./";</script>`);
            }
            grandTotal += item.price * item.quantity;
        }

        // 3% 적립금 계산 (소수점 버림)
        const earnedPoints = Math.floor(grandTotal * 0.03);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            let hasError = false;

            items.forEach(item => {
                const totalPrice = item.price * item.quantity;
                
                // 1. 주문 내역 저장
                db.run('INSERT INTO orders (user_id, product_name, price, quantity) VALUES (?, ?, ?, ?)',
                    [user.id, item.name, totalPrice, item.quantity], 
                    (err) => { if (err) hasError = true; }
                );

                // 2. 상품 재고 차감
                db.run('UPDATE products SET stock = stock - ? WHERE id = ?', 
                    [item.quantity, item.id], 
                    (err) => { if (err) hasError = true; }
                );
            });

            // 3. 결제된 장바구니 비우기
            db.run(`DELETE FROM cart_items WHERE user_id = ? AND product_id IN (${placeholders})`, params, (err) => {
                if (err) hasError = true;
            });

            // 4. 유저에게 적립금 지급
            db.run('UPDATE users SET points = COALESCE(points, 0) + ? WHERE id = ?', [earnedPoints, user.id], (err) => {
                if (err) hasError = true;
            });

            db.get('SELECT 1', (err) => {
                if (hasError) {
                    console.error("❌ 결제 중 오류 발생. 데이터를 롤백합니다.");
                    db.run('ROLLBACK');
                    return res.send('<script>alert("결제 처리 중 서버 오류가 발생했습니다. 처음부터 다시 시도해주세요."); history.back();</script>');
                } else {
                    console.log(`✅ 결제 성공. (적립금 ${earnedPoints}P 지급)`);
                    db.run('COMMIT');
                    return res.send(`<script>alert("결제가 완료되었습니다!\\n적립금 ${earnedPoints.toLocaleString()}P가 지급되었습니다."); location.href="../user/orders";</script>`);
                }
            });
        });
    });
});

module.exports = router;