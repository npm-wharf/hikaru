require('../setup')

const diff = require('../../src/k8s/specDiff')

describe('Spec Differences', function () {
  const simple = diff.simple
  const complex = diff.complex
  const canPatch = diff.canPatch
  const canReplace = diff.canReplace

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
                  name: 'one',
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

    it('should not treat equivalent units as different', function () {
      const a1 = {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'one',
                  image: 'test',
                  resources: {
                    limits: {
                      cpu: '1000m'
                    }
                  }
                }
              ]
            }
          }
        }
      }
      const b1 = {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'one',
                  image: 'test',
                  resources: {
                    limits: {
                      cpu: '100%'
                    }
                  }
                }
              ]
            }
          }
        }
      }
      const diff1 = simple(a1, b1)
      diff1.should.eql({})

      const a2 = {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'one',
                  image: 'test',
                  resources: {
                    limits: {
                      cpu: '1.5'
                    }
                  }
                }
              ]
            }
          }
        }
      }
      const b2 = {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'one',
                  image: 'test',
                  resources: {
                    limits: {
                      cpu: '1500m'
                    }
                  }
                }
              ]
            }
          }
        }
      }
      const diff2 = simple(a2, b2)
      diff2.should.eql({})
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

    it('should ignore hostPath type on source manifest', function () {
      const a = {
        spec: {
          template: {
            spec: {
              volumes: [
                {
                  hostPath: {
                  }
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
              volumes: [
                {
                  hostPath: {
                    type: 'Directory'
                  }
                }
              ]
            }
          }
        }
      }
      const diff = simple(a, b)
      diff.should.eql({})
    })

    it('should include clusterIP in diff when included', function () {
      const svcOrig = {
        kind: 'Service',
        spec: {
          clusterIP: '10.39.245.246',
          type: 'ClusterIP',
          sessionAffinity: 'None'
        }
      }

      const svcNew = {
        kind: 'Service',
        spec: {
          sessionAffinity: 'None'
        }
      }

      const diff = simple(svcOrig, svcNew)
      diff.should.eql({
        spec: {
          clusterIP: '10.39.245.246',
          type: 'ClusterIP'
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

  describe('can patch or replace', function () {
    it('should return false for patch when spec changes ClusterIP', function () {
      canPatch({
        spec: {
          clusterIP: 'None'
        }
      }).should.equal(false)
    })

    it('should return false for replace when spec changes ClusterIP', function () {
      canReplace({
        spec: {
          clusterIP: 'None'
        }
      }).should.equal(false)
    })

    it('should return false for patch and replace when spec changes select', function () {
      canPatch({
        spec: {
          selector: {
          }
        }
      }).should.equal(false)
      canReplace({
        spec: {
          selector: {
          }
        }
      }).should.equal(false)
    })

    it('should return false for patch and true for replace when port is included', function () {
      canPatch({
        spec: {
          template: {
            spec: {
              containers: [
                {
                  ports: [
                    {
                      name: 'http',
                      containerPort: 8028
                    }
                  ]
                }
              ]
            }
          }
        }
      }).should.equal(false)

      canPatch({
        spec: {
          template: {
            spec: {
              containers: [
                {
                  ports: [
                    {
                      name: 'http'
                    }
                  ]
                }
              ]
            }
          }
        }
      }).should.equal(false)

      canReplace({
        spec: {
          template: {
            spec: {
              containers: [
                {
                  ports: [
                    {
                      name: 'http',
                      containerPort: 8028
                    }
                  ]
                }
              ]
            }
          }
        }
      }).should.equal(true)

      canReplace({
        spec: {
          template: {
            spec: {
              containers: [
                {
                  ports: [
                    {
                      name: 'http'
                    }
                  ]
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
