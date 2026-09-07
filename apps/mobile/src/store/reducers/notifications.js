import { ADD_NOTIFICATION, READ_NOTIFICATION, REMOVE_NOTIFICATION } from '../actions';

const initialState = []

export default notifications = (state = initialState, action) => {
    switch(action.type){
        case ADD_NOTIFICATION:
            const newData = state.map(n=> n);
            newData.unshift(action.payload);
            return newData
        case REMOVE_NOTIFICATION:
            const filteredData = state.filter(n=> n.id != action.payload)
            return filteredData;
        case READ_NOTIFICATION:
            const updatedData = state.map(n=> {
                if(n.id == action.payload){
                    n.read = true;
                }
                return n;
            })
            return updatedData;
        default: 
            return state;
    }
}