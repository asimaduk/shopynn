import { SET_USER, SET_LOGGED_IN } from '../actions';

const initialState = {
   isLoggedIn: false
}

export default user = (state = initialState, action) => {
    switch(action.type){
        case SET_USER:
            // console.log('setting user', action.payload);
            return Object.assign({}, state, action.payload);
        case SET_LOGGED_IN:
            let newdata = {loggedInBefore:true, isLoggedIn: action.payload};
            if(!action.payload){
                newdata = {
                    loggedInBefore:true, 
                    isLoggedIn: action.payload,
                }
            }
            return Object.assign({}, state, newdata);
        default:
            return state;
    }
}