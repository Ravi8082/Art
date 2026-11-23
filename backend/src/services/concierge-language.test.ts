import assert from 'node:assert/strict'
import test from 'node:test'
import { avoidImmediateRepeat, detectConciergeIntent, detectConciergeLanguage, inferFollowUpIntent, isConciergeCheckIn, isSpecificFactualQuestion, leadershipRoster, shouldSendGreeting } from './concierge-language.js'

test('THOA classifies greetings and the requested Hinglish questions', () => {
  assert.equal(detectConciergeIntent('hi'), 'GREETING')
  assert.equal(detectConciergeIntent('namaste'), 'GREETING')
  assert.equal(detectConciergeIntent('hii kaise ho'), 'GREETING')
  assert.equal(detectConciergeIntent('kya haal hai?'), 'GREETING')
  assert.equal(detectConciergeIntent('hello, how are you?'), 'GREETING')
  assert.equal(detectConciergeIntent('thank you so much'), 'APPRECIATION')
  assert.equal(detectConciergeIntent('about'), 'MENTOR_STORY')
  assert.equal(detectConciergeIntent('kya aap apne website ke bare me bata sakte ho kaise work karti h'), 'PLATFORM')
  assert.equal(detectConciergeIntent('tell me about the website'), 'PLATFORM')
  assert.equal(detectConciergeIntent('metor and founder'), 'MENTOR_STORY')
  assert.equal(detectConciergeIntent('Who is Vinod Dara Singh?'), 'MENTOR_STORY')
  assert.equal(detectConciergeIntent('Tell me about Anil Kumar B. G.'), 'MENTOR_STORY')
  assert.equal(detectConciergeIntent('Mita V. Agarwal'), 'MENTOR_STORY')
  assert.equal(detectConciergeIntent('Who is Ravi Gupta?'), 'MENTOR_STORY')
  assert.equal(detectConciergeLanguage('Vinod Dara Singh kaun hain?'), 'HINGLISH')
  assert.equal(detectConciergeIntent('kitne log participated in 2026?'), 'EDITION_STATS')
  assert.equal(detectConciergeIntent('2026 editions'), 'EDITION_STATS')
  assert.equal(detectConciergeIntent('stall kaise book kare'), 'STALL_BOOKING')
  assert.equal(detectConciergeIntent('next exhibition kab hai'), 'UPCOMING_EXHIBITIONS')
  assert.equal(detectConciergeIntent('fees kitni hai'), 'STALL_BOOKING')
  assert.equal(detectConciergeIntent('visitor pass price'), 'VISITOR_PASSES')
  assert.equal(detectConciergeIntent('VIP entry fee'), 'VISITOR_PASSES')
  assert.equal(detectConciergeIntent('I am bored, give me an art prompt'), 'ART_ENGAGEMENT')
  assert.equal(detectConciergeIntent('time pass ke liye koi sketch prompt do'), 'ART_ENGAGEMENT')
  assert.equal(detectConciergeIntent('share some colour palette ideas'), 'ART_ENGAGEMENT')
})

test('THOA distinguishes casual check-ins from specific questions without verified answers', () => {
  assert.equal(isConciergeCheckIn('hii kaise ho?'), true)
  assert.equal(isConciergeCheckIn('kya haal hai'), true)
  assert.equal(isConciergeCheckIn('How are you?'), true)
  assert.equal(isSpecificFactualQuestion('What time does the gallery open?'), true)
  assert.equal(isSpecificFactualQuestion('kya parking available hai?'), true)
  assert.equal(isSpecificFactualQuestion('Can you help me?'), false)
  assert.equal(isSpecificFactualQuestion('What do you think?'), false)
  assert.equal(isSpecificFactualQuestion('What is your favorite color?'), false)
  assert.equal(isSpecificFactualQuestion('I love the art here.'), false)
  assert.equal(isSpecificFactualQuestion('How are you?'), false)
})

test('THOA leadership knowledge includes the current leadership roster in every language', () => {
  for (const language of ['ENGLISH', 'HINGLISH', 'HINDI'] as const) {
    const answer = leadershipRoster[language]
    for (const name of [
      'Vinod Dara Singh',
      'Anil Kumar B. G.',
      'Mita V. Agarwal',
      'L. Sankar Ramakrishnan',
      'Ravi Gupta',
      'Priya Menon',
    ]) {
      assert.ok(answer.includes(name), `${language} roster should include ${name}`)
    }
  }
  assert.match(leadershipRoster.ENGLISH, /Mentor: Vinod Dara Singh/)
  assert.match(leadershipRoster.ENGLISH, /Founder & CEO: Anil Kumar B\. G\./)
  assert.match(leadershipRoster.ENGLISH, /Co-Founder: Mita V\. Agarwal/)
  assert.match(leadershipRoster.ENGLISH, /Chairman: L\. Sankar Ramakrishnan/)
})

test('THOA detects English, Hinglish and Hindi reply languages', () => {
  assert.equal(detectConciergeLanguage('Hello, when is the next show?'), 'ENGLISH')
  assert.equal(detectConciergeLanguage('namaste'), 'HINGLISH')
  assert.equal(detectConciergeLanguage('next exhibition kab hai'), 'HINGLISH')
  assert.equal(detectConciergeLanguage('kya haal hai'), 'HINGLISH')
  assert.equal(detectConciergeLanguage('shukriya'), 'HINGLISH')
  assert.equal(detectConciergeLanguage('अगली प्रदर्शनी कब है?'), 'HINDI')
})

test('THOA understands Hindi exhibition and stall questions', () => {
  assert.equal(detectConciergeIntent('अगली प्रदर्शनी कब है?'), 'UPCOMING_EXHIBITIONS')
  assert.equal(detectConciergeIntent('स्टॉल की कीमत कितनी है?'), 'STALL_BOOKING')
})

test('THOA uses the previous topic to understand short follow-up questions', () => {
  assert.equal(inferFollowUpIntent('aur uske baare mein?', 'STALL_BOOKING'), 'STALL_BOOKING')
  assert.equal(inferFollowUpIntent('what about that?', 'UPCOMING_EXHIBITIONS'), 'UPCOMING_EXHIBITIONS')
  assert.equal(inferFollowUpIntent('another one', 'ART_ENGAGEMENT'), 'ART_ENGAGEMENT')
  assert.equal(inferFollowUpIntent('hi', 'STALL_BOOKING'), 'GREETING')
})

test('THOA greets once per conversation', () => {
  assert.equal(shouldSendGreeting([]), true)
  assert.equal(shouldSendGreeting([{ sender: 'ASSISTANT' }]), false)
  assert.equal(shouldSendGreeting([{ sender: 'USER' }, { sender: 'ASSISTANT' }, { sender: 'USER' }]), false)
})

test('THOA changes a reply when it would exactly repeat the previous assistant message', () => {
  const previous = 'Namaste Ravi! I can help with stalls.'
  const next = avoidImmediateRepeat(previous, previous, 'HINGLISH', 4)
  assert.notEqual(next, previous)
  assert.match(next, /Ravi! I can help with stalls\.\n\n/)
})
