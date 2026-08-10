import rateLimit from 'express-rate-limit';

export const aiRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10분
  max: 10, // IP당 최대 10번 허용
  message: {
    success: false,
    message: "AI 문제 생성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  },
  standardHeaders: true, // `RateLimit-*` 헤더 반환
  legacyHeaders: false, // `X-RateLimit-*` 헤더 비활성화
});

export const aiRecommendationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "AI 맞춤 추천 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  },
  standardHeaders: true,
  legacyHeaders: false,
});
