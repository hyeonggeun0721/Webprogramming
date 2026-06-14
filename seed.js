const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 데이터베이스 파일 경로 (프로젝트 루트의 db 폴더 안)
const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("🛠️ ECO-LIFE 데이터베이스 초기화 시작...");

    // 1. 기존 테이블 삭제 (구조를 새로 잡기 위함)
    db.run("DROP TABLE IF EXISTS products");

    // 2. 필요한 모든 컬럼을 포함하여 테이블 생성
    db.run(`CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER,
        description TEXT,
        image_url TEXT,
        category TEXT,
        is_featured INTEGER DEFAULT 0
    )`, (err) => {
        if (err) {
            console.error("❌ 테이블 생성 실패:", err.message);
            return;
        }
        console.log("✅ 테이블 구조 생성 완료 (image_url, category 컬럼 포함)");

        // 3. 상품 데이터 준비 (작성하신 20개 리스트)
        const products = [
            // [bathroom 카테고리]
            ['대나무 칫솔', 1400, '플라스틱 프리! 생분해되는 대나무 소재의 칫솔', 'toothbrush.jpg', 'bathroom'],
            ['친환경 삼베 샤워타올', 12900, '무자극 부드러운 100% 면 샤워볼', 'showertowel.jpg', 'bathroom'],
            ['100% 천연 목화솜(5장)', 7500, '친환경 화장솜', 'cotton.jpg', 'bathroom'],
            ['친환경 삼베 페이스타올', 7900, '환경과 피부에 부담없는 생분해성 페이스타올', 'facetowel.jpg', 'bathroom'],
            ['대나무화장지30M 30롤', 18900, '100% 대나무 펄프로 만든 화장지', 'tissue.jpg', 'bathroom'],
            ['대나무 칫솔 케이스', 5500, '대나무 칫솔 케이스', 'toothbrushcase.jpg', 'bathroom'],
            ['실리콘 칫솔뚜껑', 800, '위생적으로 휴대할 수 있는 실리콘 칫솔 뚜껑', 'toothbrushcover.jpg', 'bathroom'],
            ['업사이클링 고래 비누받침', 11000, '플라스틱을 재활용하여 만든 비누받침', 'soapdish.jpg', 'bathroom'],
            ['그린클린 치실 (30ml)', 3900, '종이 패키지로 구성된 식물성 재질 치실', 'dentalfloss.jpg', 'bathroom'],
            ['혀클리너', 2000, '친환경 무독성 CXP목재 혀클리너', 'tonguecleaner.jpg', 'bathroom'],

            // [kitchen 카테고리]
            ['스테인리스 빨대', 1000, '우리의 삶을 바꾸는 첫 걸음', 'straw.jpg', 'kitchen'],
            ['식기세척기 세제 타블렛', 12800, '세정+린스 올인원 세제', 'cleanser.jpg', 'kitchen'],
            ['천연라텍스 고무장갑', 3000, '천연라텍스로 환경호르몬 제로!', 'rubbergloves.jpg', 'kitchen'],
            ['하프앞치마(RE)', 29000, '방수 앞치마가 된 12개의 페트병', 'halfapron.jpg', 'kitchen'],
            ['밀짚 글루프리 키친타올', 14900, '100% 천연 밀짚 펄프', 'kitchentowel.jpg', 'kitchen'],
            ['손편한 앞접시 세트', 16500, '친환경 무독성 앞접시 세트(5개입)', 'frontplate.jpg', 'kitchen'],
            ['대나무 캠핑 수저세트', 9800, '귤 하나 무게의 캠핑용 수저세트', 'cutlery.jpg', 'kitchen'],
            ['자상한 농부 설거지비누', 4900, '착한 비누로 시작하는 설거지 루틴', 'dishsoap.jpg', 'kitchen'],
            ['바른행주 1장 (2겹)', 3500, '쓸수록 손이 가는 필수 살림템', 'dishcloth.jpg', 'kitchen'],
            ['친환경 삼베 수세미 (3개입)', 12900, '자연을 간직한 국산 삼베 수세미', 'loofah.jpg', 'kitchen']
        ];

        const stmt = db.prepare("INSERT INTO products (name, price, description, image_url, category, is_featured) VALUES (?, ?, ?, ?, ?, ?)");

        products.forEach((p) => {
            stmt.run(p, (err) => {
                if (err) console.error(`❌ 삽입 에러 (${p[0]}):`, err.message);
            });
        });

        stmt.finalize(() => {
            console.log("✨ 총 20개의 친환경 상품 데이터가 성공적으로 저장되었습니다!");
            db.close();
        });
    });
});