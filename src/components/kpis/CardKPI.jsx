import { Card, Typography } from '@mui/material';


export default function CardKPI({ title, value }) {
return (
<Card elevation={4} sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 2 }}>
<Typography variant="caption" color="text.secondary">{title}</Typography>
<Typography variant="h5" fontWeight="bold">{value}</Typography>
</Card>
);
}