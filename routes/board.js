const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '../db/database.sqlite'));

// [1] 고객센터 목록 (필터 + 검색 + 페이징 + 대시보드 연동 통합)
router.get('/', (req, res) => {
    const { category, search, status } = req.query;
    const page = parseInt(req.query.page) || 1; 
    const limit = 10; 
    const offset = (page - 1) * limit;

    let whereClause = ' WHERE 1=1';
    let params = [];

    // 카테고리 필터링
    if (category && category !== '전체') {
        whereClause += ' AND category = ?';
        params.push(category);
    }

    // 제목 검색
    if (search) {
        whereClause += ' AND title LIKE ?';
        params.push('%' + search + '%');
    }

    // 대시보드 위젯 클릭 연동: 답변 대기 상태만 필터링
    if (status === 'pending') {
        whereClause += " AND status = '답변 대기' AND parent_id IS NULL"; 
    }

    // 1. 전체 게시글 개수 조회 (페이징용)
    db.get('SELECT COUNT(*) as count FROM board' + whereClause, params, (err, countRow) => {
        if (err) return res.send("DB 카운트 에러: " + err.message);

        const totalPosts = countRow ? countRow.count : 0;
        const totalPages = Math.ceil(totalPosts / limit) || 1;

        // 2. 실제 데이터 조회 (원글과 답글을 묶어서 정렬 - SQLite 호환성 100%)
        const dataQuery = `SELECT * FROM board ${whereClause} ORDER BY CASE WHEN parent_id IS NULL OR parent_id = '' THEN id ELSE parent_id END DESC, id ASC LIMIT ? OFFSET ?`;
        const dataParams = [...params, limit, offset];

        db.all(dataQuery, dataParams, (err, posts) => {
            if (err) return res.send("DB 조회 에러: " + err.message);

            res.render('board', {
                posts: posts,
                user: req.session.user || null,
                currentPage: page,          
                totalPages: totalPages,     
                currentCategory: category || '전체',
                searchKeyword: search || '',
                currentStatus: status || '' 
            });
        });
    });
});

// [2] 글쓰기 페이지
router.get('/new', (req, res) => {
    if (!req.session.user) {
        // 💡 [/user/login] -> [../login] 상위 상대 경로 이동
        return res.send('<script>alert("로그인이 필요합니다."); location.href="../login";</script>');
    }
    res.render('board_write', { 
        user: req.session.user,
        post: null,      
        parentId: null   
    });
});

// [3] 글쓰기 처리 (관리자가 답글 작성 시에만 원본 상태 '답변 완료' 자동 변경)
router.post('/new', (req, res) => {
    // 💡 [/user/login] -> [../login] 리다이렉트 상대 경로 변경
    if (!req.session.user) return res.redirect('../login');

    const { category, title, content, author: formAuthor, parent_id } = req.body;
    const realUsername = req.session.user.username; 
    const userId = req.session.user.id;
    const finalAuthor = formAuthor || realUsername;

    const sql = `INSERT INTO board (category, title, content, author, user_id, parent_id, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, DATETIME('now', 'localtime'))`;
    
    db.run(sql, [category, title, content, finalAuthor, userId, parent_id || null], function(err) {
        if (err) return res.send('등록 실패: ' + err.message);
        
        // 💡 부모 글이 있고(답글이고) && 실제 작성자가 'admin'일 때만 상태 변경
        if (parent_id && realUsername === 'admin') {
            db.run("UPDATE board SET status = '답변 완료' WHERE id = ?", [parent_id], (updateErr) => {
                if (updateErr) console.error("상태 업데이트 에러:", updateErr);
                // 💡 [/board] -> [./] 현재 게시판 룰 기점 이동
                res.redirect('./'); 
            });
        } else {
            // 💡 [/board] -> [./] 리다이렉트 변경
            res.redirect('./');
        }
    });
});

// [4] 고객센터 게시글 상세 보기 (board_view.ejs 렌더링)
router.get('/view/:id', (req, res) => {
    const postId = req.params.id;

    db.get('SELECT * FROM board WHERE id = ?', [postId], (err, post) => {
        if (err) return res.send("DB 조회 에러: " + err.message);
        // 💡 [/board] -> [../../] 계층 깊이(view/:id) 고려 상위 폴더 매칭
        if (!post) return res.send('<script>alert("존재하지 않는 게시글입니다."); location.href="../../board";</script>');

        db.all('SELECT * FROM board WHERE parent_id = ? ORDER BY id ASC', [postId], (err, replies) => {
            if (err) return res.send("답글 조회 에러: " + err.message);

            res.render('board_view', {
                post: post,
                replies: replies, 
                user: req.session.user || null
            });
        });
    });
});

// [5] 답글 쓰기 페이지
router.get('/reply/:parentId', (req, res) => {
    if (!req.session.user) {
        // 💡 [/user/login] -> [../../login] 깊이 매칭
        return res.send('<script>alert("로그인이 필요합니다."); location.href="../../login";</script>');
    }
    
    const parentId = req.params.parentId;

    db.get('SELECT * FROM board WHERE id = ?', [parentId], (err, parentPost) => {
        if (err || !parentPost) {
            // 💡 [/board] -> [../../board] 연동
            return res.send('<script>alert("원본 글을 찾을 수 없습니다."); location.href="../../board";</script>');
        }

        res.render('board_reply', { 
            user: req.session.user,
            parentId: parentId, 
            parentTitle: parentPost.title 
        });
    });
});

// [6] 게시글/답글 수정 페이지 로드
router.get('/edit/:id', (req, res) => {
    if (!req.session.user) {
        // 💡 [/user/login] -> [../../login] 깊이 변경
        return res.send('<script>alert("로그인이 필요합니다."); location.href="../../login";</script>');
    }

    const postId = req.params.id;

    db.get('SELECT * FROM board WHERE id = ?', [postId], (err, post) => {
        if (err) return res.send("DB 조회 에러: " + err.message);
        // 💡 [/board] -> [../../board] 연동
        if (!post) return res.send('<script>alert("존재하지 않는 게시글입니다."); location.href="../../board";</script>');

        if (req.session.user.username !== post.author) {
            return res.send('<script>alert("본인이 작성한 글만 수정할 수 있습니다. 관리자도 고객의 글은 수정할 수 없습니다."); history.back();</script>');
        }

        res.render('board_write', {
            user: req.session.user,
            post: post, 
            parentId: post.parent_id
        });
    });
});

// [7] 게시글/답글 수정 처리 실행
router.post('/edit/:id', (req, res) => {
    // 💡 [/user/login] -> [../../login] 리다이렉트 변경
    if (!req.session.user) return res.redirect('../../login');

    const postId = req.params.id;
    const { category, title, content } = req.body;

    db.get('SELECT author FROM board WHERE id = ?', [postId], (err, post) => {
        if (err || !post) return res.send('글을 찾을 수 없습니다.');

        if (req.session.user.username !== post.author) {
            return res.send('<script>alert("수정 권한이 없습니다."); history.back();</script>');
        }

        const updateSql = `UPDATE board SET category = ?, title = ?, content = ? WHERE id = ?`;
        
        db.run(updateSql, [category, title, content, postId], (updateErr) => {
            if (updateErr) return res.send('수정 실패: ' + updateErr.message);
            // 💡 [/board/view/:id] -> [../view/:id] 동일 상세 라우터 계층 호출로 수정
            res.redirect(`../view/${postId}`);
        });
    });
});

// [8] 게시글/답글 삭제 처리
router.get('/delete/:id', (req, res) => {
    if (!req.session.user) {
        // 💡 [/user/login] -> [../../login] 변경
        return res.send('<script>alert("로그인이 필요합니다."); location.href="../../login";</script>');
    }

    const postId = req.params.id;
    const currentUser = req.session.user.username;
    const isAdmin = currentUser === 'admin';

    db.get('SELECT * FROM board WHERE id = ?', [postId], (err, post) => {
        if (err || !post) {
            return res.send('<script>alert("존재하지 않는 게시글입니다."); history.back();</script>');
        }

        if (post.author !== currentUser && !isAdmin) {
            return res.send('<script>alert("삭제 권한이 없습니다."); history.back();</script>');
        }

        // 1차: 게시글 또는 답글 삭제 실행
        db.run('DELETE FROM board WHERE id = ? OR parent_id = ?', [postId, postId], (deleteErr) => {
            if (deleteErr) return res.send('삭제 실패: ' + deleteErr.message);
            
            // 2차: 방금 지운 글이 '답글'이었다면, 남은 답글이 있는지 확인
            if (post.parent_id) {
                db.get('SELECT COUNT(*) AS count FROM board WHERE parent_id = ?', [post.parent_id], (countErr, row) => {
                    // 남은 답글이 0개라면 원글 상태를 다시 '답변 대기'로 되돌림
                    if (!countErr && row && row.count === 0) {
                        db.run("UPDATE board SET status = '답변 대기' WHERE id = ?", [post.parent_id], () => {
                            // 💡 [/board] -> [../] 상위 목록 루트 이동
                            res.redirect('../');
                        });
                    } else {
                        // 💡 [/board] -> [../] 상위 목록 루트 이동
                        res.redirect('../');
                    }
                });
            } else {
                // 원글을 지운 경우는 상태 업데이트 없이 바로 목록으로 이동
                // 💡 [/board] -> [../] 상위 목록 루트 이동
                res.redirect('../');
            }
        });
    });
});

module.exports = router;