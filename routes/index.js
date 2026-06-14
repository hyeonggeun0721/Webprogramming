const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

router.get('/', (req, res) => {
    db.all('SELECT * FROM products', [], (err, products) => {
        if (err) {
            console.error("DB 조회 에러:", err);
            return res.status(500).send("DB Error");
        }
        
        let featuredProducts = products.filter(p => p.is_featured === 1);
        if (featuredProducts.length === 0) {
            featuredProducts = products; 
        }
        
        if (req.session.user) {
            const userId = req.session.user.id;
            // 💡 product_name -> product_id 로 수정
            db.all('SELECT product_id FROM wishlist WHERE user_id = ?', [userId], (err, wishlistRows) => {
                res.render('index', { 
                    title: '홈',                     
                    featuredProducts: featuredProducts, 
                    allProducts: products,              
                    user: req.session.user, 
                    wishlist: wishlistRows              
                });
            });
        } else {
            res.render('index', { 
                title: '홈',                     
                featuredProducts: featuredProducts, 
                allProducts: products,              
                user: null, 
                wishlist: [] 
            });
        }
    });
});

module.exports = router;