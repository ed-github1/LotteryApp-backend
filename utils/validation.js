import Joi from 'joi'

export const countryConfigs = [
  {
    code: 'CA',
    name: 'Lotto Max',
    flag: 'ca',
    totalNumbers: 49,
    winnerNumber: null
  },
  {
    code: 'IT',
    name: 'Super Ena lotto',
    flag: 'it',
    totalNumbers: 90,
    winnerNumber: null
  },
  {
    code: 'MX',
    name: 'Melate',
    flag: 'mx',
    totalNumbers: 56,
    winnerNumber: null
  },
  {
    code: 'NZ',
    name: 'New Zealand Lotto',
    flag: 'nz',
    totalNumbers: 40,
    winnerNumber: null
  },
  {
    code: 'KR',
    name: 'Nanum Lotto',
    flag: 'kr',
    totalNumbers: 45,
    winnerNumber: null
  },
  {
    code: 'IE',
    name: 'Ireland Lotto',
    flag: 'ie',
    totalNumbers: 47,
    winnerNumber: null
  },
  {
    code: 'UK',
    name: 'UK Lotto',
    flag: 'gb',
    totalNumbers: 59,
    winnerNumber: null
  },
  {
    code: 'FR',
    name: 'France Lotto',
    flag: 'fr',
    totalNumbers: 10,
    winnerNumber: null
  }
]

// Create a map for quick lookup
const countryMax = countryConfigs.reduce((acc, country) => {
  acc[country.code] = country.totalNumbers
  return acc
}, {})

// Custom validation for selections
const selectionsSchema = Joi.object().keys(
  Object.keys(countryMax).reduce((acc, code) => {
    acc[code] = Joi.number().integer().min(1).max(countryMax[code])
    return acc
  }, {})
)

export const orderSchema = Joi.object({
  tickets: Joi.array().items(
    Joi.object({
      selections: selectionsSchema
    })
  ).min(1).required(),
  tkid: Joi.string().required(),
  paymentMethod: Joi.string().required()
}).unknown(true) // Add this to allow unknown fields like user

export const validateOrder = (data) => orderSchema.validate(data)
