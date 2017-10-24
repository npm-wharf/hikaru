require('./setup')

const diff = require('../src/specDiff')

describe('Spec Differences', function () {
  const simple = diff.simple
  const complex = diff.complex
  const canPatch = diff.canPatch

  describe('simple diffs', function () {
    it('should only include the properties that are different', function () {
      const a = {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'one',
                  image: 'test',
                  env: [
                    {
                      name: 'a',
                      value: 'one'
                    },
                    {
                      name: 'b',
                      value: 'three'
                    }
                  ]
                }
              ]
            }
          }
        }
      }
      const b = {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'one',
                  image: 'test',
                  env: [
                    {
                      name: 'a',
                      value: 'two'
                    },
                    {
                      name: 'b',
                      value: 'three'
                    }
                  ]
                }
              ]
            }
          }
        }
      }
      const diff = simple(a, b)
      diff.should.eql({
        spec: {
          template: {
            spec: {
              containers: [
                {
                  env: [
                    {
                      value: 'two'
                    }
                  ]
                }
              ]
            }
          }
        }
      })
    })

    it('should produce expected diff', function () {
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
      const diff = simple(a, b)
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

  describe('complex diffs', function () {
    it('should include full item when objects in array are different', function () {
      const a = {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'one',
                  image: 'test',
                  env: [
                    {
                      name: 'a',
                      value: 'one'
                    },
                    {
                      name: 'b',
                      value: 'three'
                    }
                  ]
                }
              ]
            }
          }
        }
      }
      const b = {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'one',
                  image: 'test',
                  env: [
                    {
                      name: 'a',
                      value: 'two'
                    },
                    {
                      name: 'b',
                      value: 'three'
                    }
                  ]
                }
              ]
            }
          }
        }
      }
      const diff = complex(a, b)
      diff.should.eql({
        spec: {
          template: {
            spec: {
              containers: [
                {
                  env: [
                    {
                      name: 'a',
                      value: 'two'
                    }
                  ]
                }
              ]
            }
          }
        }
      })
    })

    it('should produce expected diff', function () {
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
      const diff = complex(a, b)
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
      })
    })
  })

  describe('can patch', function () {
    it('should return false when containers have env variables', function () {
      canPatch({
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'test',
                  env: [
                    {
                      name: 'ONE',
                      value: '1'
                    }
                  ]
                }
              ]
            }
          }
        }
      }).should.equal(false)
    })

    it('should return false when containers have command changes', function () {
      canPatch({
        spec: {
          template: {
            spec: {
              containers: [
                {
                  command: [ 'test' ]
                }
              ]
            }
          }
        }
      }).should.equal(false)
    })

    it('should return true when containers do not have env or command changes', function () {
      canPatch({
        spec: {
          template: {
            spec: {
              containers: [
                {
                }
              ]
            }
          }
        }
      }).should.equal(true)
    })
  })

  describe('backoff only detection', function () {
    it('should detect when diff is backoffLimit change only', function () {
      const diff1 = {
        spec: {
          template: {
            spec: {
              backoffLimit: 4
            }
          }
        }
      }

      const diff2 = {
        spec: {
          template: {
            spec: {
              backoffLimit: 2
            }
          }
        }
      }

      const job = {
        spec: {
          template: {
            spec: {
              backoffLimit: 4
            }
          }
        }
      }

      diff.isBackoffOnly(diff1, job).should.equal(true)
      diff.isBackoffOnly(diff2, job).should.equal(false)
      diff.isBackoffOnly({}, job).should.equal(false)
    })
  })
})
