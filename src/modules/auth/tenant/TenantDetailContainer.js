import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link } from "react-router-dom";

import {
	Container, Row, Col,
	Card, CardHeader, CardFooter,
	CardBody, DropdownToggle, DropdownMenu,
	DropdownItem, Dropdown, Input
} from 'reactstrap';

import ReactJson from 'react-json-view';
import { DateTime, DataTable, ButtonWithAuthz, Credentials } from 'asab-webui';

import { CustomDataContainer } from '../components/CustomDataContainer';

function TenantDetailContainer(props) {
	let tenant_id = props.match.params.tenant_id;
	const { t } = useTranslation();
	let SeaCatAuthAPI = props.app.axiosCreate('seacat_auth');
	const [data, setData] = useState({
		'_id': ''
	});
	const [customTenantData, setCustomTenantData] = useState({'': ''});
	const [credentialsList, setCredentialsList] = useState([]);
	const [assignedCredentialsDropdown, setAssignedCredentialsDropdown] = useState([]);
	const resourceUnassign = "seacat:tenant:assign";
	const resourceEdit = "seacat:tenant:edit";
	const resourceDelete = "seacat:tenant:delete";
	const resources = useSelector(state => state.auth?.resources);
	const advmode = useSelector(state => state.advmode?.enabled);
	const theme = useSelector(state => state.theme);
	const currentTenant = useSelector(state => state.tenant?.current);

	const [count, setCount] = useState(0);
	const [dropdownCount, setDropdownCount] = useState(0);
	const timeoutRef = useRef(null);
	const [page, setPage] = useState(1);
	const [filter, setFilter] = useState("");
	const [dropdownLimit, setDropdownLimit] = useState(10);
	const limit = 10;
	const [loading, setLoading] = useState(true);
	const [loadingCustomData, setLoadingCustomData] = useState(true);
	const [show, setShow] = useState(false);
	const [dropdownOpen, setDropdownOpen] = useState(false);

	const toggleDropdown = () => setDropdownOpen(prevState => !prevState);

	const headers = [
		{
			name: t('TenantDetailContainer|Name'),
			customComponent: {
				generate: (obj) => (
					<div
						style={{
							whiteSpace: "nowrap",
							maxWidth: "40ch",
							textOverflow: "ellipsis",
							overflow: "hidden",
							marginBottom: 0
						}}
					>
						{obj.suspended === true ?
							<span className="at-user-xmark text-muted mr-1" title={t("TenantDetailContainer|Credentials suspended")} />
							: <span className="at-account mr-1" />}
						<Link
							style={{ color: obj.suspended === true && '#73818f' }}
							to={{
								pathname: `/auth/credentials/${obj._id}`,
							}}>
							{/* TODO: substitute with Credentials component, when it's ready */}
							{obj.username ??  obj._id}
						</Link>
					</div>
				)
			}
		},
		{
			name: " ",
			customComponent: {
				generate: (credentials) => (
					<div className="d-flex justify-content-end">
						<ButtonWithAuthz
							outline
							title={t("TenantDetailContainer|Unassign credentials")}
							id={credentials._id}
							size="sm"
							color="danger"
							onClick={() => {unassignCredentialsForm(credentials._id)}}
							resource={resourceUnassign}
							resources={resources}
						>
							<i className="at-xmark-circle"></i>
						</ButtonWithAuthz>
					</div>
				)
			}
		}
	];

	const suspendRow = { condition: (row) => (row.suspended === true), className: "bg-light" };

	useEffect(() => {
		retrieveData();
	}, []);

	useEffect(() => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			timeoutRef.current = null;
			retrieveCredentialsForDropdown()
		}, 500);
	}, [filter]);

	useEffect(() => {
		setShow(false);
		if (credentialsList.length === 0) {
			// Timeout delays appearance of content loader in DataTable. This measure prevents 'flickering effect' during fast fetch of data, where content loader appears just for a split second.
			setTimeout(() => setShow(true), 500);
		};
		retrieveAssignedCredentials();
	}, [page]);

	useEffect(() => {
		retrieveCredentialsForDropdown();
	}, [dropdownLimit]);

	const retrieveData = async () => {
		try {
			let response = await SeaCatAuthAPI.get(`/tenant/${tenant_id}`);
			setData(response.data);
			response.data?.data && setCustomTenantData(response.data.data);
			setLoadingCustomData(false);
		} catch (e) {
			console.error(e);
			setLoadingCustomData(false);
			props.app.addAlert("warning", `${t("TenantDetailContainer|Something went wrong, failed to fetch tenant detail")}. ${e?.response?.data?.message}`, 30);
		}
	};

	const retrieveAssignedCredentials = async () => {
		try {
			let response = await SeaCatAuthAPI.get(`/credentials?m=tenant&f=${tenant_id}`, {params: {p:page, i: limit}});
			if (response.data.result === 'NOT-AUTHORIZED') {
				setCredentialsList([]);
				setLoading(false);
				setCount(0);
				return;
			} else if (response.data.result !== "OK") {
				throw new Error(t("TenantDetailContainer|Something went wrong, failed to fetch assigned credentials"));
			}
			setCredentialsList(response.data.data);
			setCount(response.data.count);
			setLoading(false);
		} catch (e) {
			console.error(e);
			setLoading(false);
			props.app.addAlert("warning", `${t("TenantDetailContainer|Something went wrong, failed to fetch assigned credentials")}. ${e?.response?.data?.message}`, 30);
		}
	};

	const removeTenant = async () => {
		try {
			let response = await SeaCatAuthAPI.delete(`/tenant/${tenant_id}`);
			if (response.data.result !== "OK") {
				throw new Error(t("TenantDetailContainer|Failed to remove tenant"));
			}
			if (tenant_id == currentTenant) {
				// Reload page when removing the current tenant
				props.app.addAlert("success", t("TenantDetailContainer|Tenant removed successfully, you will be logged out in a while"));
				setTimeout(() => {
					window.location.reload();
				}, 5000)
			} else {
				props.app.addAlert("success", t("TenantDetailContainer|Tenant removed successfully"));
				props.history.push("/auth/tenant");
			}
		} catch(e) {
			console.error(e);
			props.app.addAlert("warning", `${t("TenantDetailContainer|Failed to remove the tenant")}. ${e?.response?.data?.message}`, 30);
		}
	}

	// Receives data from all credentials
	const retrieveCredentialsForDropdown = async () => {
		let response;
		try {
			response = await SeaCatAuthAPI.get("/credentials", {params: {i: dropdownLimit, f: filter}});
			if (response.data.result !== "OK") {
				throw new Error(t("TenantDetailContainer|Something went wrong, failed to fetch data"));
			}
			setAssignedCredentialsDropdown(response.data.data);
			setDropdownCount(response.data.count);
			setLoading(false);
		} catch(e) {
			console.error(e);
			setLoading(false);
			if (e.response.status === 401) {
				props.app.addAlert("warning", t("TenantDetailContainer|Can't fetch the data, you don't have rights to display it"), 30);
				return;
			}
			props.app.addAlert("warning", `${t("TenantDetailContainer|Something went wrong, failed to fetch data")}. ${e?.response?.data?.message}`, 30);
		}
	};

	// Assign user to particular tenant
	const assignCredentials = async (credentialsId) => {
		try {
			let response = await SeaCatAuthAPI.post(`/tenant_assign/${credentialsId}/${tenant_id}`);

			if (response.data.result != 'OK') {
				throw new Error(t('TenantDetailContainer|Unable to assign credentials'));
			}
			retrieveAssignedCredentials();


		} catch(e) {
			if (e.response?.data?.result === "ALREADY-EXISTS") {
				props.app.addAlert("warning", t("TenantDetailContainer|The selected credential has already been assigned"), 30);
			} else {
				console.error(e);
				props.app.addAlert("warning", `${t("TenantDetailContainer|Something went wrong, the credentials cannot be assigned")}. ${e?.response?.data?.message}`, 30);
			}
		}
	};

	// Unassign user to particular tenant
	const unassignCredentials = async (credentialsId) => {
		try {
			let response = await SeaCatAuthAPI.delete(`/tenant_assign/${credentialsId}/${tenant_id}`);

			if (response.data.result != 'OK') {
				throw new Error(t('TenantDetailContainer|Unable to unassign credentials'));
			}
			retrieveAssignedCredentials();

		} catch(e) {
			console.error(e);
			props.app.addAlert("warning", `${t("TenantDetailContainer|Something went wrong, the credentials cannot be unassigned")}. ${e?.response?.data?.message}`, 30);
		}
	};

	const unassignCredentialsForm = (credentialsId) => {
		var r = confirm(t('TenantDetailContainer|Do you want to unassign these credentials?'));
		if (r == true) {
			unassignCredentials(credentialsId);
		}
	}

	const removeTenantForm = () => {
		const r = confirm(t("TenantDetailContainer|Do you want to remove the tenant?"));
		if (r) removeTenant();
	}

	const assignNewCredentials = (
		<Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
			<DropdownToggle
				title={(resources.indexOf(resourceUnassign) == -1 && resources.indexOf("authz:superuser") == -1) && t("You do not have access rights to perform this action")}
				disabled={(resources.indexOf(resourceUnassign) == -1 && resources.indexOf("authz:superuser") == -1)}
				caret
				outline
				color="primary"
				className="card-header-dropdown"
			>
				{t("TenantDetailContainer|Assign credentials")}
			</DropdownToggle>
			<DropdownMenu className="assign-credential-list-dropdown">
				<DropdownItem header>
					<Input
						className="m-0"
						placeholder={t("TenantDetailContainer|Search")}
						onChange={e => setFilter(e.target.value)}
						value={filter}
					/>
				</DropdownItem>
				{loading ?
					<DropdownItem><span>{t("TenantDetailContainer|Loading...")}</span></DropdownItem>
					:
					(assignedCredentialsDropdown && Object.keys(assignedCredentialsDropdown).map((item, i) => {
						return (
							<DropdownItem key={assignedCredentialsDropdown[item]._id} onClick={() => assignCredentials(assignedCredentialsDropdown[item]._id)}>
								{assignedCredentialsDropdown[item].username ?
									<span>{assignedCredentialsDropdown[item].username}</span>
									:
									<Credentials
										className="disabled-link"
										app={props.app}
										credentials_ids={assignedCredentialsDropdown[item]._id}
									/>
								}
							</DropdownItem>
						)
					}))}
					{dropdownCount > dropdownLimit ?
						<>
							<DropdownItem divider />
							<DropdownItem
								onClick={() => {
									setDropdownLimit(dropdownLimit + 5);
									toggleDropdown();
								}}
							>
								{t("TenantDetailContainer|More")}
							</DropdownItem>
						</>
						:
						null
					}
				{assignedCredentialsDropdown.length === 0 && <DropdownItem><span>{t("TenantDetailContainer|No match")}</span></DropdownItem>}
			</DropdownMenu>
		</Dropdown>
	);

	return (
		<Container fluid className="tenant-detail-container tenant-detail-wrapper">
			<div className="tenant-detail-info">
				<Card className="tenant-general-info">
					<CardHeader className="border-bottom">
						<div className="card-header-title">
							<i className="at-menu-square pr-2"></i>
							{t("TenantDetailContainer|Tenant")}
						</div>
					</CardHeader>

					<CardBody>
						<Row>
							<Col md={3}>{t("Name")}</Col>
							<Col>{data._id}</Col>
						</Row>

						<Row className="mt-3">
							<Col md={3}>{t("Created at")}</Col>
							<Col><DateTime value={data._c} /></Col>
						</Row>

						<Row>
							<Col md={3}>{t("Modified at")}</Col>
							<Col><DateTime value={data._m} /></Col>
						</Row>
						{data.created_by &&
							<Row>
								<Col md={3}>{t("Created by")}</Col>
								<Col>
									<Credentials
										app={props.app}
										credentials_ids={data.created_by}
									/>
								</Col>
							</Row>
						}
					</CardBody>

					<CardFooter>
						<ButtonWithAuthz
							title={t("TenantDetailContainer|Remove tenant")}
							color="danger"
							outline
							onClick={removeTenantForm}
							resource={resourceDelete}
							resources={resources}
						>
							{t("TenantDetailContainer|Remove tenant")}
						</ButtonWithAuthz>
					</CardFooter>
				</Card>

				<CustomDataContainer
					resource={resourceEdit}
					resources={resources}
					customData={customTenantData}
					setCustomData={setCustomTenantData}
					app={props.app}
					loading={loadingCustomData}
					uri={`tenant/${tenant_id}`}
				/>
			</div>

			<div className="credentials-card">
				<DataTable
					title={{
						text: t("TenantDetailContainer|Assigned credentials"),
						icon: "at-list-folder"
					}}
					headers={headers}
					data={credentialsList}
					count={count}
					limit={limit}
					currentPage={page}
					setPage={setPage}
					customComponent={assignNewCredentials}
					customRowClassName={suspendRow}
					isLoading={loading}
					contentLoader={show}
				/>
			</div>
			{advmode &&
				<Card className="w-100 adv-card">
					<CardHeader className="border-bottom">
						<div className="card-header-title">
							<i className="at-programming pr-2"></i>
							JSON
						</div>
					</CardHeader>
					{data !== null ?
						<CardBody>
							<ReactJson
								theme={theme === 'dark' ? "chalk" : "rjv-default"}
								src={data}
								name={false}
								collapsed={false}
							/>
						</CardBody>
						: null}
				</Card>
			}
		</Container>
	)
}

export default TenantDetailContainer;
