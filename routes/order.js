const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// 1. 주문서 확인 페이지 띄우기 (장바구니에서 넘어옴)
router.post('/checkout', (req, res) => {
    const user = req.session.user;
    // 💡 [/user/login] -> [../user/login] 상위 상대 경로 변경
    if (!user) return res.redirect('./user/login');

    const checkedIds = req.body.checkedIds;

    if (!checkedIds || checkedIds.trim() === "") {
        return res.send('<script>alert("선택된 상품이 없습니다."); history.back();</script>');
    }

    const idsArray = checkedIds.split(',').map(id => parseInt(id.trim()));
    const placeholders = idsArray.map(() => '?').join(',');

    const selectQuery = `
        SELECT p.id, p.name, p.price, p.image_url, c.quantity
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ? AND c.product_id IN (${placeholders})
    `;

    db.all(selectQuery, [user.id, ...idsArray], (err, items) => {
        if (err || items.length === 0) {
            // 💡 [/cart] -> [../cart] 상위 장바구니 경로 매칭
            return res.send('<script>alert("상품 정보를 불러올 수 없습니다."); location.href="../cart";</script>');
        }

        db.get('SELECT * FROM users WHERE id = ?', [user.id], (err, userInfo) => {
            res.render('order_checkout', {
                user: userInfo || user,
                items: items,
                checkedIds: checkedIds
            });
        });
    });
});

// 2. 최종 결제 처리 (+ 이메일 업데이트 및 적립금 지급)
router.post('/process', (req, res) => {
    const user = req.session.user;
    // 💡 [/user/login] -> [../user/login] 상위 상대 경로 변경
    if (!user) return res.redirect('./user/login');

    const { checkedIds, email, phone, address, memo } = req.body;

    if (!checkedIds || checkedIds.trim() === "") {
        return res.send('<script>alert("결제 정보가 유효하지 않습니다."); history.back();</script>');
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
            // 💡 [/cart] -> [../cart] 상위 경로 매칭
            return res.send('<script>alert("결제할 상품 정보를 찾을 수 없습니다."); location.href="../cart";</script>');
        }

        // 총 결제 금액 계산 및 재고 확인
        let grandTotal = 0;
        for (let item of items) {
            if (item.stock < item.quantity) {
                // 💡 [/cart] -> [../cart] 상위 경로 매칭
                return res.send(`<script>alert("${item.name}의 재고가 부족합니다."); location.href="../cart";</script>`);
            }
            grandTotal += item.price * item.quantity;
        }

        // 3% 적립금 계산 (소수점 버림)
        const earnedPoints = Math.floor(grandTotal * 0.03);

        // 트랜잭션 시작
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            let hasError = false;

            db.get('SELECT email FROM users WHERE id = ?', [user.id], (userErr, row) => {
                if (userErr) {
                    console.error("❌ 이메일 조회 에러:", userErr.message);
                    hasError = true;
                } else if (!row || !row.email || row.email.trim() === "") {
                    db.run('UPDATE users SET email = ? WHERE id = ?', [email, user.id], (updateErr) => {
                        if (updateErr) {
                            console.error("❌ 이메일 저장 에러:", updateErr.message);
                            hasError = true;
                        } else {
                            req.session.user.email = email;
                        }
                    });
                }
            });

            items.forEach(item => {
                const totalPrice = item.price * item.quantity;
                
                const insertOrderQuery = `
                    INSERT INTO orders (user_id, product_id, product_name, price, quantity, phone, address, memo) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                db.run(insertOrderQuery, 
                    [user.id, item.id, item.name, totalPrice, item.quantity, phone, address, memo], 
                    (err) => { if (err) hasError = true; }
                );

                db.run('UPDATE products SET stock = stock - ? WHERE id = ?', 
                    [item.quantity, item.id], 
                    (err) => { 
                        if (err) {
                            console.error("❌ 재고 차감 에러:", err.message);
                            hasError = true; 
                        }
                    }
                );
            });

            db.run(`DELETE FROM cart_items WHERE user_id = ? AND product_id IN (${placeholders})`, params, (err) => {
                if (err) {
                    console.error("❌ 장바구니 삭제 에러:", err.message);
                    hasError = true;
                }
            });

            // 유저에게 적립금 지급
            db.run('UPDATE users SET points = COALESCE(points, 0) + ? WHERE id = ?', [earnedPoints, user.id], (err) => {
                if (err) {
                    console.error("❌ 적립금 지급 에러:", err.message);
                    hasError = true;
                }
            });

            db.get('SELECT 1', (err) => { 
                if (hasError) {
                    db.run('ROLLBACK'); 
                    return res.send('<script>alert("결제 처리 중 서버 오류가 발생했습니다."); history.back();</script>');
                } else {
                    db.run('COMMIT'); 
                    // 💡 [/order/complete] -> [./complete] 현재 폴더(/order) 기준 주소 호출로 변경
                    // order.js 파일 내의 결제 성공 로직 수정
                    return res.send(`<script>alert("결제가 완료되었습니다!\\n적립금 ${earnedPoints.toLocaleString()}P가 지급되었습니다."); location.href="/order/complete";</script>`);
                }
            });
        });
    });
});

// 3. 결제 완료 페이지 렌더링
router.get('/complete', (req, res) => {
    const user = req.session.user;
    // 💡 [/login] -> [../user/login] (또는 기존 연동 구조 맞춰 정확히 매칭되도록 ../user/login 지정)
    if (!user) return res.redirect('./user/login');
    
    res.render('order_complete', { user });
});

module.exports = router;