import { Routes } from './routes'
import { Query } from './queries'
import { Mutation } from './mutations'
import { costCenterName, organizationName } from './fieldResolvers'

export const resolvers = {
  Mutation,
  Query,
  Quote: {
    costCenterName,
    organizationName,
  },
  Routes,
}
