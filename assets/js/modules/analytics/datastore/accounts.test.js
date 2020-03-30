/**
 * modules/analytics data store: accounts tests.
 *
 * Site Kit by Google, Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import API from 'googlesitekit-api';
import { STORE_NAME } from './index';
import {
	createTestRegistry,
	muteConsole,
	subscribeUntil,
	unsubscribeFromAll,
} from 'tests/js/utils';
import * as fixtures from './__fixtures__';

describe( 'modules/analytics accounts', () => {
	let apiFetchSpy;
	let registry;
	let store;

	beforeAll( () => {
		API.setUsingCache( false );
	} );

	beforeEach( () => {
		registry = createTestRegistry();
		store = registry.stores[ STORE_NAME ].store;

		apiFetchSpy = jest.spyOn( { apiFetch }, 'apiFetch' );
	} );

	afterAll( () => {
		API.setUsingCache( true );
	} );

	afterEach( () => {
		unsubscribeFromAll( registry );
		apiFetchSpy.mockRestore();
	} );

	describe( 'actions', () => {

	} );

	describe( 'selectors', () => {
		describe( 'getAccounts', () => {
			it( 'uses a resolver to make a network request', async () => {
				registry.dispatch( STORE_NAME ).setSettings( {} );
				fetch
					.doMockOnceIf(
						/^\/google-site-kit\/v1\/modules\/analytics\/data\/accounts-properties-profiles/
					)
					.mockResponseOnce(
						JSON.stringify( fixtures.accountsPropertiesProfiles ),
						{ status: 200 }
					);

				const accountID = fixtures.accountsPropertiesProfiles.properties[ 0 ].accountId; // Capitalization rule exception: `accountId` is a property of an API returned value.
				const propertyID = fixtures.accountsPropertiesProfiles.profiles[ 0 ].webPropertyId; // Capitalization rule exception: `webPropertyId` is a property of an API returned value.

				const initialAccounts = registry.select( STORE_NAME ).getAccounts();
				// The connection info will be its initial value while the connection
				// info is fetched.
				expect( initialAccounts ).toEqual( undefined );
				await subscribeUntil( registry,
					() => (
						registry.select( STORE_NAME ).getAccounts() !== undefined
					),
				);

				const accounts = registry.select( STORE_NAME ).getAccounts();
				expect( fetch ).toHaveBeenCalledTimes( 1 );

				// Properties and profiles should also have been received by
				// this action.
				muteConsole( 'error', 2 );
				const properties = registry.select( STORE_NAME ).getProperties( accountID );
				const profiles = registry.select( STORE_NAME ).getProfiles( accountID, propertyID );

				expect( accounts ).toEqual( fixtures.accountsPropertiesProfiles.accounts );
				expect( properties ).toEqual( fixtures.accountsPropertiesProfiles.properties );
				expect( profiles ).toEqual( fixtures.accountsPropertiesProfiles.profiles );
			} );

			it( 'does not make a network request if accounts are already present', async () => {
				registry.dispatch( STORE_NAME ).receiveAccounts( fixtures.accountsPropertiesProfiles.accounts );

				const accounts = registry.select( STORE_NAME ).getAccounts();

				await subscribeUntil( registry, () => registry
					.select( STORE_NAME )
					.hasFinishedResolution( 'getAccounts' )
				);

				expect( accounts ).toEqual( fixtures.accountsPropertiesProfiles.accounts );
				expect( fetch ).not.toHaveBeenCalled();
			} );

			it( 'does not make a network request if accounts exist but are empty (this is a valid state)', async () => {
				registry.dispatch( STORE_NAME ).receiveAccounts( [] );

				const accounts = registry.select( STORE_NAME ).getAccounts();

				await subscribeUntil( registry, () => registry
					.select( STORE_NAME )
					.hasFinishedResolution( 'getAccounts' )
				);

				expect( accounts ).toEqual( [] );
				expect( fetch ).not.toHaveBeenCalled();
			} );

			it( 'dispatches an error if the request fails', async () => {
				const response = {
					code: 'internal_server_error',
					message: 'Internal server error',
					data: { status: 500 },
				};
				fetch
					.doMockIf(
						/^\/google-site-kit\/v1\/modules\/analytics\/data\/accounts-properties-profiles/
					)
					.mockResponse(
						JSON.stringify( response ),
						{ status: 500 }
					);

				muteConsole( 'error' );
				registry.select( STORE_NAME ).getAccounts();
				await subscribeUntil( registry,
					// TODO: We may want a selector for this, but for now this is fine
					// because it's internal-only.
					() => store.getState().isFetchingAccountsPropertiesProfiles === false,
				);

				expect( fetch ).toHaveBeenCalledTimes( 1 );

				const accounts = registry.select( STORE_NAME ).getAccounts();
				expect( accounts ).toEqual( undefined );
			} );

			it( 'set passes existing tag IDs when fetching accounts', async () => {
				const existingAccountID = '12345';
				const existingPropertyID = 'UA-12345-1';

				registry.dispatch( STORE_NAME ).receiveExistingTag( {
					accountID: existingAccountID,
					propertyID: existingPropertyID,
				} );
				registry.dispatch( STORE_NAME ).setSettings( {} );

				fetch
					.doMockOnceIf(
						/^\/google-site-kit\/v1\/modules\/analytics\/data\/accounts-properties-profiles/
					)
					.mockResponseOnce(
						JSON.stringify( fixtures.accountsPropertiesProfiles ),
						{ status: 200 }
					);

				registry.select( STORE_NAME ).getAccounts();

				await subscribeUntil( registry,
					() => (
						registry.select( STORE_NAME ).getAccounts() !== undefined
					),
				);

				// Ensure the proper parameters were sent.
				expect( fetch.mock.calls[ 0 ][ 0 ] ).toMatchQueryParameters(
					{
						existingAccountID,
						existingPropertyID,
					}
				);
				expect( fetch ).toHaveBeenCalledTimes( 1 );
			} );
		} );

		it( 'sets accountID, and propertyID in the store, if a matchedProperty is received and values are not set yet', async () => {
			const { matchedProperty } = fixtures.accountsPropertiesProfiles;

			registry.dispatch( STORE_NAME ).setSettings( {} );

			fetch
				.doMockOnceIf(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/accounts-properties-profiles/
				)
				.mockResponseOnce(
					JSON.stringify( fixtures.accountsPropertiesProfiles ),
					{ status: 200 }
				);

			expect( store.getState().matchedProperty ).toBeFalsy();
			expect( registry.select( STORE_NAME ).getAccountID() ).toBeFalsy();
			expect( registry.select( STORE_NAME ).getPropertyID() ).toBeFalsy();

			registry.select( STORE_NAME ).getAccounts();

			await subscribeUntil( registry,
				() => (
					registry.select( STORE_NAME ).getAccounts() !== undefined
				),
			);

			expect( store.getState().matchedProperty ).toMatchObject( matchedProperty );
			expect( registry.select( STORE_NAME ).getAccountID() ).toBe( matchedProperty.accountId );
			expect( registry.select( STORE_NAME ).getPropertyID() ).toBe( matchedProperty.id );
		} );
	} );
} );
