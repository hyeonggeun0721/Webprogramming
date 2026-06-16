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

// [2] 글쓰기 페이지
router.get('/new', (req, res) => {
    const user = req.session.user;
    if (!user || user.username !== 'admin') {
        // 💡 [/notice] -> [./] 현재 라우팅 파일 소속 레벨로 상대 경로 변경
        return res.send('<script>alert("관리자만 작성할 수 있습니다."); location.href="./";</script>');
    }
    res.render('notice_write', { user });
});

// [3] 글쓰기 처리 (주제 category 컬럼 저장 로직 추가)
router.post('/new', upload.single('attachment'), (req, res) => {
    const user = req.session.user;
    // 💡 [/notice] -> [./] 상대 경로 리다이렉트 변경
    if (!user || user.username !== 'admin') return res.redirect('./');

    const { category, title, content } = req.body; 
    
    db.run('INSERT INTO notices (category, title, content) VALUES (?, ?, ?)', [category, title, content], function(err) {
        if (err) return res.send('작성 실패');
        
        const noticeId = this.lastID;
        if (req.file) {
            db.run('INSERT INTO files (post_id, filename, filepath) VALUES (?, ?, ?)', 
            [noticeId, req.file.originalname, '/uploads/' + req.file.filename], (fileErr) => {
                // 💡 [/notice] -> [./] 상대 경로 리다이렉트 변경
                res.redirect('./');
            });
        } else {
            // 💡 [/notice] -> [./] 상대 경로 리다이렉트 변경
            res.redirect('./');
        }
    });
});

// [4] 삭제 처리
router.get('/delete/:id', (req, res) => {
    const user = req.session.user;
    // 💡 [/notice] -> [../] 현재 위치 계층(/delete/:id) 기점 상위 폴더 매칭
    if (!user || user.username !== 'admin') return res.redirect('../');
    
    db.run('DELETE FROM notices WHERE id = ?', [req.params.id], (err) => {
        // 💡 [/notice] -> [../] 상대 경로 리다이렉트 변경
        res.redirect('../');
    });
});

// [5] 공지사항 상세 보기 (이전글/다음글 통합)
router.get('/view/:id', (req, res) => {
    const noticeId = req.params.id;
    const user = req.session.user;

    db.get('SELECT * FROM notices WHERE id = ?', [noticeId], (err, notice) => {
        if (err || !notice) {
            // 💡 [/notice] -> [../] 현재 위치 계층(/view/:id) 기점 상위 폴더 매칭
            return res.send('<script>alert("게시글을 찾을 수 없습니다."); location.href="../";</script>');
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

// [6] 공지사항 수정 처리
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
        
        // 💡 수정 완료 후, 절대 경로를 이용해 해당 공지사항 상세 페이지로 다시 이동
        res.redirect('/stud6/notice/view/' + id);
    });
});

module.exports = router;