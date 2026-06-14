const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// ✅ 추천 상품 페이지 (메인)
router.get('/', (req, res) => {
    // 1. 전체 상품 조회 (통계용 등)
    db.all('SELECT * FROM products', (err, allProducts) => {
        if (err) return res.status(500).send('DB 오류: 전체 상품 조회 실패');

        // 2. 추천 상품 조회 (is_featured = 1)
        db.all('SELECT * FROM products WHERE is_featured = 1', (err2, featuredProducts) => {
            if (err2) return res.status(500).send('DB 오류: 추천 상품 조회 실패');

            // 3. 로그인된 사용자의 찜 목록 조회
            if (req.session.user) {
                const userId = req.session.user.id;
                // 💡 버그 수정: product_name이 아니라 product_id를 가져와야 찜 상태가 반영됨
                db.all('SELECT product_id FROM wishlist WHERE user_id = ?', [userId], (err3, wishlistRows) => {
                    res.render('products', {
                        allProducts: allProducts,
                        featuredProducts: featuredProducts,
                        user: req.session.user,
                        wishlist: wishlistRows // 찜 목록 전달
                    });
                });
            } else {
                // 비로그인 시 빈 배열 전달
                res.render('products', {
                    allProducts: allProducts,
                    featuredProducts: featuredProducts,
                    user: null,
                    wishlist: []
                });
            }
        });
    });
});

// ✅ 전체 상품 목록 페이지 (검색 및 카테고리 필터 추가)
router.get('/all', (req, res) => {
    const keyword = req.query.keyword || '';
    const category = req.query.category || '';

    let sql = 'SELECT * FROM products WHERE 1=1';
    let params = [];

    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    if (keyword) {
        sql += ' AND name LIKE ?';
        params.push('%' + keyword + '%');
    }
    
    sql += ' ORDER BY id DESC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).send('전체 상품 목록 불러오기 실패');

        if (req.session.user) {
            const userId = req.session.user.id;
            // 💡 버그 수정: 여기도 product_id로 변경
            db.all('SELECT product_id FROM wishlist WHERE user_id = ?', [userId], (err2, wishlistRows) => {
                res.render('products_all', {
                    products: rows,
                    user: req.session.user,
                    wishlist: wishlistRows,
                    query: req.query // 검색어 유지를 위해 추가
                });
            });
        } else {
            res.render('products_all', {
                products: rows,
                user: null,
                wishlist: [],
                query: req.query // 검색어 유지를 위해 추가
            });
        }
    });
});

module.exports = router;