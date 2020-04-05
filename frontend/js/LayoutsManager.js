import myLayouts from '../data/layouts.json';

// TODO: Load this from the backend
export const LayoutsManager = () => {

    var layouts = myLayouts;

    const GetDataForLayout = (layoutName) => {
        console.log(`GetDataForLayout ${layoutName}`);
        if (!layoutName || !layouts[layoutName]) {
            throw Error('No valid layout name provided');
        }
        return layouts[layoutName].colliders;
    }

    const GetLayoutNames = () => {
        console.log("GetLayoutNames");
        return Object.keys(layouts);
    }

    return { GetDataForLayout, GetLayoutNames };
}
