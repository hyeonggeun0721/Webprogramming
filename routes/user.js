const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// [1단계 화면]
router.get('/register', (req, res) => {
    res.render('register_step1'); 
});

// [1단계 데이터 처리]
router.post('/register/step1', (req, res) => {
    const { name, phone, address } = req.body;
    req.session.tempUser = { name, phone, address };
    // 💡 [/user/register/step2] -> [./step2] 현재 위치 기점 상대 경로 매칭
    res.redirect('./step2');
});

// [2단계 화면]
router.get('/register/step2', (req, res) => {
    // 💡 [/user/register] -> [../register] 계층 깊이(/register/step2) 고려 상위 매칭
    if (!req.session.tempUser) return res.redirect('../register');
    res.render('register_step2'); 
});

// [2단계 최종 처리]
router.post('/register/step2', async (req, res) => {
    const { username, password } = req.body;
    const tempUser = req.session.tempUser;
    // 💡 [/user/register] -> [../register] 계층 깊이(/register/step2) 고려 상위 매칭
    if (!tempUser) return res.redirect('../register');

    const { name, phone, address } = tempUser;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (user) {
            res.send('<script>alert("이미 존재하는 아이디입니다."); history.back();</script>');
        } else {
            db.run('INSERT INTO users (username, password, name, phone, address, status) VALUES (?, ?, ?, ?, ?, "active")',
                [username, hashedPassword, name, phone, address], (err) => {
                    delete req.session.tempUser;
                    // 💡 [/user/login] -> [../login] 계층 깊이(/register/step2) 고려 상위 매칭
                    res.send('<script>alert("가입 완료!"); location.href="../login";</script>');
                });
        }
    });
});

// 로그인 페이지
router.get('/login', (req, res) => {
    res.render('login');
});

// 로그인 처리
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ? AND status = "active"', [username], async (err, user) => {
        if (err) return res.send('조회 에러');
        if (!user) return res.send('<script>alert("아이디가 없거나 탈퇴한 회원입니다."); history.back();</script>');

        const match = await bcrypt.compare(password, user.password);

        if (match) {
            req.session.user = { 
                id: user.id, 
                username: user.username, 
                name: user.name,
                phone: user.phone,
                address: user.address
            };
            // 💡 [/] -> [../] 상위 루트 경로 이동
            res.redirect('../');
        } else {
            res.send('<script>alert("비밀번호가 틀렸습니다."); history.back();</script>');
        }
    });
});

// 로그아웃
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('로그아웃 오류:', err);
        // 💡 [/] -> [../] 상위 루트 경로 이동
        res.redirect('../');
    });
});

// 마이페이지 (개인정보 + 게시글 내역 조회)
router.get('/mypage', (req, res) => {
    const user = req.session.user;
    if (!user) {
        // 💡 [/user/login] -> [./login] 같은 레벨 상대 경로 매칭
        return res.send('<script>alert("로그인이 필요합니다."); location.href="./login";</script>');
    }
    
    db.get('SELECT * FROM users WHERE id = ?', [user.id], (err, userInfo) => {
        if (err || !userInfo) return res.send('<script>alert("회원 정보 조회 실패"); history.back();</script>');
        
        db.all('SELECT * FROM board WHERE author = ? ORDER BY id DESC', [userInfo.username], (err, myPosts) => {
            res.render('mypage', { 
                user: userInfo,
                myPosts: myPosts || []
            });
        });
    });
});

// 개인정보 수정 처리
router.post('/update', async (req, res) => {
    // 💡 [/user/login] -> [./login] 리다이렉트 상대 경로 변경
    if (!user) {
        return res.send('<script>alert("로그인이 필요합니다."); location.href="./login";</script>');
    }

    const { name, password, phone, address } = req.body;
    const userId = req.session.user.id;

    if (password) {
        // 비밀번호 변경 시
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            'UPDATE users SET name = ?, password = ?, phone = ?, address = ? WHERE id = ?',
            [name, hashedPassword, phone, address, userId],
            (err) => {
                if (err) return res.send('<script>alert("수정 실패"); history.back();</script>');
                
                req.session.destroy();
                // 💡 [/user/login] -> [./login] 변경
                res.send('<script>alert("정보가 수정되었습니다. 다시 로그인해주세요."); location.href="./login";</script>');
            }
        );
    } else {
        // 비밀번호 미변경 시
        db.run(
            'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
            [name, phone, address, userId],
            (err) => {
                if (err) return res.send('<script>alert("수정 실패"); history.back();</script>');
                
                req.session.user.name = name;
                req.session.user.phone = phone;
                req.session.user.address = address;
                // 💡 [/user/mypage] -> [./mypage] 변경
                res.send('<script>alert("정보가 수정되었습니다."); location.href="./mypage";</script>');
            }
        );
    }
});

// 회원 탈퇴 처리
router.post('/delete-account', (req, res) => {
    const user = req.session.user;
    // 💡 [/user/login] -> [./login] 리다이렉트 상대 경로 변경
    if (!user) {
        return res.send('<script>alert("로그인이 필요합니다."); location.href="./login";</script>');
    }

    if (user.username === 'admin') {
        return res.send('<script>alert("관리자 계정은 탈퇴할 수 없습니다."); history.back();</script>');
    }

    const { password } = req.body;

    db.get('SELECT password FROM users WHERE id = ?', [user.id], async (err, row) => {
        if (err || !row) return res.send('<script>alert("오류가 발생했습니다."); history.back();</script>');

        const match = await bcrypt.compare(password, row.password);
        if (!match) {
            return res.send('<script>alert("비밀번호가 일치하지 않습니다."); history.back();</script>');
        }

        db.run('UPDATE users SET status = "withdrawn" WHERE id = ?', [user.id], (err) => {
            if (err) return res.send('<script>alert("탈퇴 처리 실패"); history.back();</script>');
            
            req.session.destroy(() => {
                // 💡 [/] -> [../] 상위 루트 경로 이동
                res.send('<script>alert("회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다."); location.href="../";</script>');
            });
        });
    });
});

// 위시리스트 조회
router.get('/wishlist', (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.send('<script>alert("로그인이 필요합니다."); location.href="./login";</script>');
    }

    const query = `
        SELECT w.id, p.name AS product_name, p.price, p.image_url AS image, p.id AS product_id
        FROM wishlist w
        JOIN products p ON w.product_id = p.id
        WHERE w.user_id = ?`;

    db.all(query, [user.id], (err, rows) => {
        if (err) return res.status(500).send("조회 오류");
        res.render('wishlist', { items: rows, user });
    });
});

// 위시리스트 추가/삭제 토글
router.post('/wishlist/toggle', (req, res) => {
    if (!req.session.user) return res.status(401).json({ status: 'login_required' });

    const { productId } = req.body; 
    const userId = req.session.user.id;

    db.get('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?', [userId, productId], (err, row) => {
        if (err) return res.status(500).json({ status: 'error' });

        if (row) {
            db.run('DELETE FROM wishlist WHERE id = ?', [row.id], (err) => {
                if (err) return res.status(500).json({ status: 'error' });
                res.json({ status: 'removed' });
            });
        } else {
            db.run('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)', [userId, productId], (err) => {
                if (err) return res.status(500).json({ status: 'error' });
                res.json({ status: 'added' });
            });
        }
    });
});

// 주문 조회 라우터 
router.get('/orders', (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.send('<script>alert("로그인이 필요합니다."); location.href="./login";</script>');
    }

    const sql = `
        SELECT o.*, p.image_url 
        FROM orders o 
        LEFT JOIN products p ON 
            TRIM(o.product_name) = TRIM(p.name) OR 
            o.product_name LIKE '%' || p.name || '%'
        WHERE o.user_id = ? 
        ORDER BY o.id DESC
    `;

    db.all(sql, [user.id], (err, orders) => {
        if (err) {
            console.error("주문 내역 조회 에러:", err.message);
            return res.status(500).send('주문 내역을 불러오는 중 오류가 발생했습니다.');
        }
        res.render('orders', { user: user, orders: orders });
    });
});

// 1. 아이디 찾기 페이지 렌더링
router.get('/find-id', (req, res) => {
    res.render('find_id');
});

// 2. 비밀번호 재설정 페이지 렌더링
router.get('/find-pw', (req, res) => {
    res.render('find_pw');
});

// 3. 아이디 찾기 처리
router.post('/find-id', (req, res) => {
    const { name, phone } = req.body;

    db.get('SELECT username FROM users WHERE name = ? AND phone = ?', [name, phone], (err, row) => {
        if (err) return res.status(500).send('DB 오류');
        
        if (row) {
            // 💡 [/login] -> [./login] 변경
            res.send(`<script>alert("회원님의 아이디는 [ ${row.username} ] 입니다."); location.href="./login";</script>`);
        } else {
            res.send(`<script>alert("일치하는 회원 정보가 없습니다."); history.back();</script>`);
        }
    });
});

// 4. 비밀번호 재설정 처리
router.post('/reset-pw', (req, res) => {
    const { username, name, phone, new_password } = req.body;

    db.get('SELECT id FROM users WHERE username = ? AND name = ? AND phone = ?', 
        [username, name, phone], 
        async (err, row) => {
            if (err) return res.status(500).send('DB 오류');
            
            if (row) {
                try {
                    const hashedPassword = await bcrypt.hash(new_password, 10);
                    db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, row.id], (updateErr) => {
                        if (updateErr) return res.status(500).send('비밀번호 변경 실패');
                        // 💡 [/login] -> [./login] 변경
                        res.send(`<script>alert("비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요."); location.href="./login";</script>`);
                    });
                } catch (hashErr) {
                    console.error('비밀번호 암호화 에러:', hashErr);
                    res.status(500).send('서버 오류');
                }
            } else {
                res.send(`<script>alert("입력한 정보와 일치하는 계정이 없습니다."); history.back();</script>`);
            }
    });
});

module.exports = router;