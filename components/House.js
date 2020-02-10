/* eslint-disable react/prop-types */
/* eslint-disable react/destructuring-assignment */
const House = props => (
  <div>
    <img src={props.picture} width="100%" alt="House img" />
    <p>
      {props.type} - {props.town}
    </p>
    <p>{props.title}</p>
    <p>
      {props.rating} ({props.reviewsCount})
    </p>
  </div>
);

export default House;
