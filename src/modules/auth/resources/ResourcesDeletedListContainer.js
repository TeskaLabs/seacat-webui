import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { DataTable, ButtonWithAuthz } from 'asab-webui';
import { Container } from 'reactstrap';

const ResourcesDeletedListContainer = (props) => {

	let SeaCatAuthAPI = props.app.axiosCreate('seacat_auth');

	const [resources, setResources] = useState([]);
	const [count, setCount] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [show, setShow] = useState(false);
	const [limit, setLimit] = useState(0);
	const [height, setHeight] = useState(0);
	const ref = useRef(null);
	const { t } = useTranslation();

	const credentialsResources = useSelector(state => state.auth?.resources);

	const headers = [
		{
			name: t("Name"),
			key: '_id',
			link: {
				pathname: '/auth/deletedresources/',
				key: '_id'
			}
		},
		{
			name: t("Created at"),
			key: '_c',
			datetime: true
		},
		{
			name: t("Description"),
			key: 'description'
		},
		{
			name: " ",
			customComponent: {
				generate: (resource) => (
					<div className="d-flex justify-content-end">
						<ButtonWithAuthz
							title={t("ResourceDeletedListContainer|Retrieve resource")}
							id={resource._id}
							size="sm"
							color="primary"
							outline
							onClick={() => {retrieveResource(resource._id)}}
							resource="authz:tenant:admin"
							resources={credentialsResources}
						>
							<i className="cil-action-undo"></i>
						</ButtonWithAuthz>
					</div>
				)
			}
		}
	];

	useEffect(() => {
		setHeight(ref.current.clientHeight);
	}, []);

	useEffect(()=>{
		setShow(false);
		if (resources.length === 0) {
			// Timeout delays appearance of content loader in DataTable. This measure prevents 'flickering effect' during fast fetch of data, where content loader appears just for a split second.
			setTimeout(() => setShow(true), 500);
		};
		if (limit > 0) {
			getResources();
		}
	}, [page, limit]);

	const getResources = async () => {
		try {
			let response = await SeaCatAuthAPI.get(`/resource`, {params: {p:page, i:limit, include_deleted:true}});
            let deletedResources = [];
            response.data.data.map((item) => {
				item.deleted === true ? deletedResources.push(item) : null;
			})
			setResources(deletedResources);
			setCount(deletedResources.length || 0);
			setLoading(false);
		} catch(e) {
			console.error(e);
			setLoading(false);
			props.app.addAlert("warning", `${t("ResourcesDeletedListContainer|Failed to load resources")}. ${e?.response?.data?.message}`, 30);
		}
	}

	// Undelete the resource
	const retrieveResource = async (resourceId) => {
		try {
			let response = await SeaCatAuthAPI.post(`/resource/${resourceId}`, {});
			if (response.data.result !== "OK") {
				throw new Error(t("ResourcesDeletedListContainer|Failed to retrieve resource"));
			}
			props.app.addAlert("success", t("ResourcesDeletedListContainer|Resource retrieved successfuly"));
			props.history.push(`resources/${resourceId}`);
		} catch(e) {
			console.error(e);
			props.app.addAlert("warning", `${t("ResourcesDeletedListContainer|Failed to retrieve resource")}. ${e?.response?.data?.message}`, 30);
		}
	}

	const customRowClassName = {
		condition: row => typeof (row.description) === "string",
		className: "description-row"
	}

	return (
		<div className="h-100" ref={ref}>
			<Container>
				<DataTable
					title={{ text: t('ResourcesDeletedListContainer|Deleted resources list'), icon: 'cil-lock-unlocked'}}
					data={resources}
					headers={headers}
					count={count}
					currentPage={page}
					setPage={setPage}
					limit={limit}
					setLimit={setLimit}
					isLoading={loading}
					contentLoader={show}
					customRowClassName={customRowClassName}
					height={height}
				/>
			</Container>
		</div>
	);

    return (
        <>
            ello worldh
        </>
    )
};

export default ResourcesDeletedListContainer;
