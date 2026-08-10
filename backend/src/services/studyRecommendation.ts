export interface StudyRecommendationSource {
  recordType: 'general' | 'certification'
  subject: string
  certificationName: string | null
  examType: 'written' | 'practical' | null
  examDate: string | null
  unit: string
  learned: string
  difficult: string
  keywords: string
  understanding: number
}

export interface StudyRecommendation {
  concept: string
  reason: string
  action: string
  examArea?: string
  questionType?: string
}

function splitKeywords(keywords: string) {
  return keywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function shorten(text: string, maximumLength: number) {
  const normalizedText = text.trim()

  if (normalizedText.length <= maximumLength) {
    return normalizedText
  }

  return `${normalizedText.slice(0, maximumLength - 1)}…`
}

export function createRuleBasedStudyRecommendations(
  source: StudyRecommendationSource,
): StudyRecommendation[] {
  const keywords = splitKeywords(source.keywords)
  const primaryConcept =
    keywords[0] || source.unit.trim()
  const secondaryConcept = keywords[1]

  if (source.recordType === 'certification') {
    const certificationName =
      source.certificationName?.trim() || '자격증 시험'
    const examTypeLabel =
      source.examType === 'practical' ? '실기' : '필기'
    const examDateMessage = source.examDate
      ? ` 시험 예정일은 ${source.examDate}입니다.`
      : ''

    const recommendations: StudyRecommendation[] = [
      {
        concept: `${primaryConcept} 시험 적용 점검`,
        examArea: `${certificationName} ${examTypeLabel} · ${source.unit}`,
        questionType:
          source.examType === 'practical'
            ? '작업형·서술형 적용 문제'
            : '개념 판별·사례형 객관식 문제',
        reason: source.difficult.trim()
          ? `“${shorten(source.difficult, 90)}” 부분을 어렵다고 기록해 ${certificationName} ${examTypeLabel}에서 개념을 구분하거나 적용하는 문제에 대비할 필요가 있습니다.${examDateMessage}`
          : `${source.unit}에서 기록한 핵심 개념을 ${certificationName} ${examTypeLabel} 문제 상황에 적용하는 연습이 필요합니다.${examDateMessage}`,
        action:
          source.examType === 'practical'
            ? `${primaryConcept}을(를) 사용하는 작업 절차나 답안 예시를 직접 작성하고, 빠진 조건이 없는지 채점 기준처럼 확인해 보세요.`
            : `${primaryConcept}을(를) 정답과 오답으로 가르는 핵심 조건을 한 줄로 정리한 뒤, 비슷한 선택지 4개를 직접 만들어 판별해 보세요.`,
      },
    ]

    if (
      secondaryConcept &&
      secondaryConcept !== primaryConcept
    ) {
      recommendations.push({
        concept: `${primaryConcept}·${secondaryConcept} 비교 출제 대비`,
        examArea: `${certificationName} ${examTypeLabel} · 연관 개념 구분`,
        questionType:
          source.examType === 'practical'
            ? '조건 비교형 실무 적용 문제'
            : '유사 개념 비교·복수 조건 문제',
        reason: `함께 기록한 두 키워드는 시험에서 비슷한 표현이나 조건으로 제시될 수 있어 차이를 정확히 구분하는 연습이 필요합니다.`,
        action: `${primaryConcept}과(와) ${secondaryConcept}의 공통점, 차이점, 선택 기준을 표로 정리하고 각 개념이 정답이 되는 예시를 하나씩 만들어 보세요.`,
      })
    }

    if (source.understanding <= 3) {
      recommendations.push({
        concept: `${source.unit} 취약 영역 재점검`,
        examArea: `${certificationName} ${examTypeLabel} · 기본 개념`,
        questionType: '핵심 개념 확인 문제',
        reason: `현재 이해도를 ${source.understanding}/5로 기록해 응용 문제보다 핵심 정의와 판단 기준을 먼저 안정시키는 것이 좋습니다.`,
        action: `공식 출제기준이나 교재 목차에서 ${source.unit}의 핵심 항목을 확인하고, 각 항목을 보지 않고 한 문장씩 설명해 보세요.`,
      })
    }

    return recommendations.slice(0, 3)
  }

  const recommendations: StudyRecommendation[] = [
    {
      concept: primaryConcept,
      reason: source.difficult.trim()
        ? `다시 보고 싶다고 기록한 내용인 “${shorten(source.difficult, 90)}”과 직접 연결되는 개념입니다.`
        : `${source.unit} 학습에서 핵심 키워드로 기록한 개념입니다.`,
      action: `${source.subject} ${source.unit}에서 ${primaryConcept}을(를) 적용하는 예제를 하나 직접 풀고, 풀이 과정을 자신의 말로 설명해 보세요.`,
    },
  ]

  if (
    secondaryConcept &&
    secondaryConcept !== primaryConcept
  ) {
    recommendations.push({
      concept: `${primaryConcept}과(와) ${secondaryConcept}의 연결`,
      reason: `함께 기록한 두 키워드의 차이와 관계를 확인하면 개념을 따로 외우는 것보다 오래 기억할 수 있습니다.`,
      action: `${primaryConcept}과(와) ${secondaryConcept}의 공통점과 차이점을 각각 한 문장으로 정리해 보세요.`,
    })
  }

  if (source.understanding <= 3) {
    recommendations.push({
      concept: `${source.unit} 기본 개념 점검`,
      reason: `현재 이해도를 ${source.understanding}/5로 기록해 기본 개념을 한 번 더 확인하는 것이 좋습니다.`,
      action: `오늘 이해한 내용을 보지 않고 3문장으로 다시 설명한 뒤, 기록한 내용과 비교해 빠진 부분을 표시해 보세요.`,
    })
  }

  return recommendations.slice(0, 3)
}
