/**
 * @typedef {Object} EventRepository
 * @property {(event: any) => Promise<void>} append
 * @property {(eventId: string, updates: any) => Promise<void>} update
 * @property {() => Promise<any[]>} list
 * @property {(eventId: string) => Promise<any|null>} findById
 */

/**
 * @typedef {Object} LeadRepository
 * @property {(lead: any) => Promise<void>} append
 * @property {(leadId: string, updates: any) => Promise<void>} update
 * @property {(leadId: string) => Promise<void>} remove
 * @property {() => Promise<any[]>} list
 * @property {(leadId: string) => Promise<any|null>} findById
 */

/**
 * @typedef {Object} IntegrationRepository
 * @property {() => Promise<any[]>} readAll
 * @property {(operation: (list: any[]) => any[]|undefined|Promise<any[]|undefined>) => Promise<any[]>} transact
 */

/**
 * @typedef {Object} LogRepository
 * @property {(entry: any) => Promise<void>} append
 * @property {() => Promise<any[]>} list
 */

module.exports = {};
