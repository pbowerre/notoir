import * as dotenv from 'dotenv'
import { MongoDBProvider } from '../mongodb/MongoDBProvider'

dotenv.config()

const MANAGED_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/notoir'

/**
 * ManagedProvider — Notoir's own hosted database.
 *
 * Personal Users select this mode.  All Notoir application data is stored
 * in Notoir's managed MongoDB Atlas cluster.  The connection details are
 * handled entirely by the application; users are never exposed to the
 * underlying URI or credentials.
 *
 * Architecturally this is an alias for MongoDBProvider initialised with
 * the managed cluster URI, which keeps the implementation DRY while
 * maintaining a clear semantic boundary between managed and developer-owned
 * databases.
 */
export class ManagedProvider extends MongoDBProvider {
  constructor() {
    super(MANAGED_URI)
  }

  /** Override to surface a user-friendly label for the managed cluster. */
  override async testConnection(): Promise<{ ok: boolean; message: string }> {
    const result = await super.testConnection()
    if (result.ok) {
      return { ok: true, message: 'Connected to Notoir managed storage.' }
    }
    return result
  }
}
