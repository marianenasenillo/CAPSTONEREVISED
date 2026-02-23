import { describe, it, expect } from 'vitest'
import {
  isEmpty,
  isNullOrUndefined,
  isEmptyArray,
  isObject,
  requiredValidator,
  emailValidator,
  passwordValidator,
  confirmedValidator,
  betweenValidator,
  integerValidator,
  regexValidator,
  alphaValidator,
  urlValidator,
  lengthValidator,
  alphaDashValidator,
} from '../validators'

describe('isEmpty', () => {
  it('returns true for null, undefined, empty string', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
    expect(isEmpty('')).toBe(true)
  })

  it('returns true for empty array', () => {
    expect(isEmpty([])).toBe(true)
  })

  it('returns false for non-empty values', () => {
    expect(isEmpty('hello')).toBe(false)
    expect(isEmpty(0)).toBe(false)
    expect(isEmpty([1])).toBe(false)
  })
})

describe('isNullOrUndefined', () => {
  it('detects null and undefined', () => {
    expect(isNullOrUndefined(null)).toBe(true)
    expect(isNullOrUndefined(undefined)).toBe(true)
  })

  it('returns false for other values', () => {
    expect(isNullOrUndefined('')).toBe(false)
    expect(isNullOrUndefined(0)).toBe(false)
    expect(isNullOrUndefined(false)).toBe(false)
  })
})

describe('isEmptyArray', () => {
  it('detects empty array', () => {
    expect(isEmptyArray([])).toBe(true)
  })

  it('returns false for non-empty array', () => {
    expect(isEmptyArray([1])).toBe(false)
  })

  it('returns false for non-arrays', () => {
    expect(isEmptyArray(null)).toBe(false)
    expect(isEmptyArray('string')).toBe(false)
  })
})

describe('isObject', () => {
  it('detects plain objects', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
  })

  it('rejects arrays, null, primitives', () => {
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject('str')).toBe(false)
    expect(isObject(42)).toBe(false)
  })
})

describe('requiredValidator', () => {
  it('returns error for null, undefined, empty', () => {
    expect(requiredValidator(null)).toBe('This field is required')
    expect(requiredValidator(undefined)).toBe('This field is required')
    expect(requiredValidator(false)).toBe('This field is required')
    expect(requiredValidator([])).toBe('This field is required')
  })

  it('returns error for whitespace-only string', () => {
    expect(requiredValidator('   ')).toBe('This field is required')
  })

  it('returns true for valid values', () => {
    expect(requiredValidator('hello')).toBe(true)
    expect(requiredValidator(0)).toBe(true)
    expect(requiredValidator(123)).toBe(true)
  })
})

describe('emailValidator', () => {
  it('returns true for empty (not required)', () => {
    expect(emailValidator('')).toBe(true)
    expect(emailValidator(null)).toBe(true)
  })

  it('validates correct emails', () => {
    expect(emailValidator('test@example.com')).toBe(true)
    expect(emailValidator('user.name@domain.co')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(emailValidator('notanemail')).toContain('valid email')
    expect(emailValidator('user@')).toContain('valid email')
  })

  it('validates array of emails', () => {
    expect(emailValidator(['a@b.com', 'c@d.com'])).toBe(true)
    expect(emailValidator(['a@b.com', 'invalid'])).toContain('valid email')
  })
})

describe('passwordValidator', () => {
  it('accepts strong password', () => {
    expect(passwordValidator('Strong1!abc')).toBe(true)
  })

  it('rejects weak passwords', () => {
    expect(passwordValidator('weak')).toContain('8 characters')
    expect(passwordValidator('alllowercase1!')).toContain('uppercase')
    expect(passwordValidator('ALLUPPERCASE1!')).toContain('lowercase')
    expect(passwordValidator('NoNumbers!')).toContain('number')
  })
})

describe('confirmedValidator', () => {
  it('matches confirmed values', () => {
    expect(confirmedValidator('pass', 'pass')).toBe(true)
  })

  it('rejects mismatched values', () => {
    expect(confirmedValidator('a', 'b')).toContain('does not match')
  })
})

describe('betweenValidator', () => {
  it('accepts value in range', () => {
    expect(betweenValidator(5, 1, 10)).toBe(true)
    expect(betweenValidator(1, 1, 10)).toBe(true)
    expect(betweenValidator(10, 1, 10)).toBe(true)
  })

  it('rejects value out of range', () => {
    expect(betweenValidator(0, 1, 10)).toContain('between')
    expect(betweenValidator(11, 1, 10)).toContain('between')
  })
})

describe('integerValidator', () => {
  it('returns true for empty', () => {
    expect(integerValidator('')).toBe(true)
  })

  it('accepts integers', () => {
    expect(integerValidator('42')).toBe(true)
    expect(integerValidator('-3')).toBe(true)
    expect(integerValidator(0)).toBe(true)
  })

  it('rejects non-integers', () => {
    expect(integerValidator('3.14')).toContain('number')
    expect(integerValidator('abc')).toContain('number')
  })

  it('validates array of integers', () => {
    expect(integerValidator(['1', '2'])).toBe(true)
    expect(integerValidator(['1', 'abc'])).toContain('number')
  })
})

describe('alphaValidator', () => {
  it('returns true for empty', () => {
    expect(alphaValidator('')).toBe(true)
  })

  it('accepts alphabetic', () => {
    expect(alphaValidator('abc')).toBe(true)
    expect(alphaValidator('ABC')).toBe(true)
  })

  it('rejects numbers/symbols', () => {
    expect(alphaValidator('abc123')).toContain('alphabetic')
  })
})

describe('urlValidator', () => {
  it('returns true for empty', () => {
    expect(urlValidator('')).toBe(true)
  })

  it('accepts valid URLs', () => {
    expect(urlValidator('https://example.com')).toBe(true)
    expect(urlValidator('http://test.org')).toBe(true)
    expect(urlValidator('www.example.com')).toBe(true)
  })

  it('rejects invalid URLs', () => {
    expect(urlValidator('justaword')).toContain('invalid')
  })
})

describe('lengthValidator', () => {
  it('returns true for empty', () => {
    expect(lengthValidator('', 5)).toBe(true)
  })

  it('accepts strings meeting min length', () => {
    expect(lengthValidator('hello', 5)).toBe(true)
    expect(lengthValidator('longer', 5)).toBe(true)
  })

  it('rejects short strings', () => {
    expect(lengthValidator('hi', 5)).toContain('5 characters')
  })
})

describe('alphaDashValidator', () => {
  it('returns true for empty', () => {
    expect(alphaDashValidator('')).toBe(true)
  })

  it('accepts alphanumeric with dashes and underscores', () => {
    expect(alphaDashValidator('test_123-abc')).toBe(true)
  })

  it('rejects other special chars', () => {
    expect(alphaDashValidator('test@123')).toContain('alphanumeric')
  })
})

describe('regexValidator', () => {
  it('returns true for empty', () => {
    expect(regexValidator('', /test/)).toBe(true)
  })

  it('matches against regex', () => {
    expect(regexValidator('hello', /^hello$/)).toBe(true)
    expect(regexValidator('world', /^hello$/)).toContain("doesn't match")
  })

  it('accepts string regex pattern', () => {
    expect(regexValidator('123', '^[0-9]+$')).toBe(true)
  })
})
