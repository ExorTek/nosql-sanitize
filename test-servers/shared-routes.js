'use strict';

const TEST_CASES = {
  basic: {
    input: { username: '$admin', password: { $ne: '' } },
    expected: { username: 'admin', password: { ne: '' } },
  },
  prototypePollution: {
    input: JSON.parse('{"__proto__": {"isAdmin": true}, "name": "$evil"}'),
    expected: { name: 'evil' },
  },
  nestedDeep: {
    input: { a: { b: { c: { d: '$deep' } } } },
    expected: { a: { b: { c: { d: 'deep' } } } },
  },
  arrayInjection: {
    input: { tags: ['$gt', 'safe', '$ne'] },
    expected: { tags: ['gt', 'safe', 'ne'] },
  },
  emailPreserved: {
    input: { email: 'user@example.com', name: '$admin' },
    expected: { email: 'user@example.com', name: 'admin' },
  },
  controlChars: {
    input: { key: 'hello\x00world', name: 'normal' },
    expected: { key: 'helloworld', name: 'normal' },
  },
  deniedKeys: {
    input: { secret: 'hidden', name: '$admin' },
    opts: { deniedKeys: ['secret'] },
    expected: { name: 'admin' },
  },
  allowedKeys: {
    input: { $set: { name: 'ok' }, $evil: 'bad' },
    opts: { allowedKeys: ['$set', 'name'] },
    expected: { $set: { name: 'ok' } },
  },
  removeMatches: {
    input: { $gt: 5, name: 'safe', $ne: '' },
    opts: { removeMatches: true },
    expected: { name: 'safe' },
  },
  replaceWith: {
    input: { $gt: 5, name: '$admin' },
    opts: { replaceWith: '_' },
    expected: { _gt: 5, name: '_admin' },
  },
  maxDepthRemove: {
    input: { level1: '$x', nested: { level2: '$y' } },
    opts: { maxDepth: 1, maxDepthBehavior: 'remove' },
    expected: { level1: 'x' },
  },
  maxDepthPreserve: {
    input: { level1: '$x', nested: { level2: '$y' } },
    opts: { maxDepth: 1, maxDepthBehavior: 'preserve' },
    expected: { level1: 'x', nested: { level2: '$y' } },
  },
  maxDepthThrow: {
    input: { nested: { deep: 'val' } },
    opts: { maxDepth: 1, maxDepthBehavior: 'throw' },
    expectError: true,
  },
  stringOptions: {
    input: { name: '  $ADMIN  ', tag: '$Hello' },
    opts: { stringOptions: { trim: true, lowercase: true, maxLength: 5 } },
    expected: { name: 'admin', tag: 'hello' },
  },
  arrayOptions: {
    input: { items: ['$a', '', '$a', null, 'b', 'b'] },
    opts: { arrayOptions: { filterNull: true, distinct: true } },
    expected: { items: ['a', 'b'] },
  },
  removeEmpty: {
    input: { name: '$', keep: 'hello' },
    opts: { removeEmpty: true },
    expected: { keep: 'hello' },
  },
  customPatterns: {
    input: { query: 'SELECT * FROM users', name: 'safe' },
    opts: { patterns: [/SELECT/gi, /FROM/gi], replaceWith: '' },
    expected: { query: ' *  users', name: 'safe' },
  },
  onSanitize: {
    input: { username: '$admin', role: '$super' },
    opts: { onSanitize: '__CALLBACK__' },
    expectedEvents: 2,
  },
};

module.exports = { TEST_CASES };
