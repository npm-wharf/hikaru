require('./setup')

const k8s = require('../src/k8s')()

describe('Deep Compare', function () {
  const compare = k8s.deepCompare
  it('should resolve to correct diff', function () {
    const a = {
      a: {
        b: {
          d: 'test 1',
          g: 'true',
          c: null
        },
        c: {
          e: [1, 2],
          f: [3, 4],
          g: [ {h: 5}, {l: 1} ],
          i: [ {j: {m: 6}} ]
        },
        d: {
          e: [1, 2, 3, 4, 5, 6],
          f: 'no'
        },
        e: {
          f: {
            g: {
              h: [1, 2, 3]
            }
          }
        },
        f: [
          {
            a: 1,
            b: 2
          },
          {
            c: 3,
            d: 4,
            e: 5
          }
        ]
      }
    }
    const b = {
      a: {
        b: {
          d: 'test 2',
          g: 'true',
          c: 1
        },
        c: {
          e: [1, 3],
          f: [3, 4],
          g: [ {h: 5}, {l: 1} ],
          i: [ {j: {m: 7}} ]
        },
        d: {
          e: [1, 2, 3, 4, 5, 6],
          f: 'yes'
        },
        e: {
          f: {
            g: {
              h: [1, 2, 3]
            }
          }
        },
        f: [
          {
            a: 1,
            b: 2
          },
          {
            c: 3,
            d: 4
          }
        ]
      }
    }
    const diff = compare(a, b)
    // console.log(JSON.stringify(diff,null,2))
    diff.should.eql({
      a: {
        b: {
          d: 'test 2',
          c: 1
        },
        c: {
          e: [1, 3],
          i: [ {j: {m: 7}} ]
        },
        d: {
          f: 'yes'
        }
      }
    })
  })
})
