const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads'),
    filename: (req, file, cb) => {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// [1] 공지사항 목록 (주제별 필터 및 제목 검색 기능 추가)
router.get('/', (req, res) => {
    const { category, search } = req.query; 
    
    let query = 'SELECT * FROM notices WHERE 1=1';
    let params = [];

    if (category && category !== '전체') {
        query += ' AND category = ?';
        params.push(category);
    }

    if (search) {
        query += ' AND title LIKE ?';
        params.push('%' + search + '%');
    }

    query += ' ORDER BY id DESC';

    db.all(query, params, (err, notices) => {
        if (err) return res.send('DB 조회 실패');
        
        res.render('notice', { 
            notices, 
            user: req.session.user,
            currentCategory: category || '전체',
            currentSearch: search || ''
        });
    });
});

// [2] 글쓰기 페이지 렌더링
router.get('/new', (req, res) => {
    const user = req.session.user;
    if (!user || user.username !== 'admin') {
        return res.send('<script>alert("관리자만 작성할 수 있습니다."); location.href="/stud6/notice";</script>');
    }
    res.render('notice_write', { user });
});

// [3] 글쓰기 처리
router.post('/new', upload.single('attachment'), (req, res) => {
    const user = req.session.user;
    if (!user || user.username !== 'admin') return res.redirect('/stud6/notice');

    const { category, title, content } = req.body; 
    
    db.run('INSERT INTO notices (category, title, content) VALUES (?, ?, ?)', [category, title, content], function(err) {
        if (err) return res.send('<script>alert("작성 실패"); history.back();</script>');
        
        const noticeId = this.lastID;
        if (req.file) {
            db.run('INSERT INTO files (post_id, filename, filepath) VALUES (?, ?, ?)', 
            [noticeId, req.file.originalname, '/uploads/' + req.file.filename], (fileErr) => {
                res.redirect('/stud6/notice');
            });
        } else {
            res.redirect('/stud6/notice');
        }
    });
});

// [4] 삭제 처리 (주의: ejs의 경로와 일치하도록 /delete/:id 유지)
router.get('/delete/:id', (req, res) => {
    const user = req.session.user;
    if (!user || user.username !== 'admin') return res.redirect('/stud6/notice');
    
    db.run('DELETE FROM notices WHERE id = ?', [req.params.id], (err) => {
        res.redirect('/stud6/notice');
    });
});

// [5] 공지사항 수정 페이지 렌더링
router.get('/edit/:id', (req, res) => {
    const user = req.session.user;
    if (!user || user.username !== 'admin') {
        return res.send('<script>alert("관리자 권한이 필요합니다."); location.href="/stud6/notice";</script>');
    }

    db.get('SELECT * FROM notices WHERE id = ?', [req.params.id], (err, notice) => {
        if (err || !notice) return res.send('<script>alert("공지사항을 찾을 수 없습니다."); history.back();</script>');
        
        // 수정 폼 화면(notice_edit.ejs)을 띄워줌
        res.render('notice_edit', { notice: notice });
    });
});

// [6] 공지사항 수정 처리 (추가됨)
router.post('/update', (req, res) => {
    const user = req.session.user;
    
    if (!user || user.username !== 'admin') {
        return res.send('<script>alert("관리자 권한이 필요합니다."); location.href="/stud6/notice";</script>');
    }

    const { id, title, content } = req.body;

    db.run('UPDATE notices SET title = ?, content = ? WHERE id = ?', [title, content, id], (err) => {
        if (err) {
            console.error("공지사항 수정 오류:", err);
            return res.send('<script>alert("수정에 실패했습니다."); history.back();</script>');
        }
        
        // 수정 완료 후 상세 페이지로 리다이렉트
        res.redirect(`/stud6/notice/view/${id}`);
    });
});

// [7] 공지사항 상세 보기
router.get('/view/:id', (req, res) => {
    const noticeId = req.params.id;
    const user = req.session.user;

    db.get('SELECT * FROM notices WHERE id = ?', [noticeId], (err, notice) => {
        if (err || !notice) {
            return res.send('<script>alert("게시글을 찾을 수 없습니다."); location.href="/stud6/notice";</script>');
        }

        db.get('SELECT * FROM files WHERE post_id = ?', [noticeId], (err, file) => {
            const prevQuery = 'SELECT id, title FROM notices WHERE id < ? ORDER BY id DESC LIMIT 1';
            const nextQuery = 'SELECT id, title FROM notices WHERE id > ? ORDER BY id ASC LIMIT 1';

            db.get(prevQuery, [noticeId], (err, prevNotice) => {
                db.get(nextQuery, [noticeId], (err, nextNotice) => {
                    res.render('notice_detail', {
                        notice: notice,
                        file: file || null,
                        prevNotice: prevNotice || null,
                        nextNotice: nextNotice || null,
                        user: user
                    });
                });
            });
        });
    });
});

// 반드시 파일의 가장 마지막에 위치해야 함
module.exports = router;