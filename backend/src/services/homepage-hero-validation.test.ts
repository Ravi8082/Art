import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { homepageHeroInput } from './homepage-hero-validation.js'

const slideId = '123e4567-e89b-42d3-a456-426614174000'
const validInput = {
  slides: [{
    id: slideId,
    imageUrl: '/api/homepage/uploads/123e4567-e89b-42d3-a456-426614174001',
    altText: 'Artists at an exhibition',
    caption: 'A featured moment',
    isActive: true,
  }],
  video: {
    url: 'https://cdn.example.com/hero.mp4',
    posterUrl: '',
    enabled: true,
    autoplay: true,
    loop: false,
  },
}

describe('homepage hero settings validation', () => {
  it('accepts uploaded media URLs and secure external video URLs', () => {
    assert.equal(homepageHeroInput.safeParse(validInput).success, true)
  })

  it('rejects unsafe URLs and enabled videos without a source', () => {
    const unsafeImage = {
      ...validInput,
      slides: [{ ...validInput.slides[0], imageUrl: 'javascript:alert(1)' }],
    }
    const missingVideo = {
      ...validInput,
      video: { ...validInput.video, url: '', enabled: true },
    }

    assert.equal(homepageHeroInput.safeParse(unsafeImage).success, false)
    assert.equal(homepageHeroInput.safeParse(missingVideo).success, false)
  })

  it('rejects duplicate slide IDs before persistence', () => {
    const duplicateSlides = { ...validInput, slides: [validInput.slides[0], validInput.slides[0]] }
    assert.equal(homepageHeroInput.safeParse(duplicateSlides).success, false)
  })
})
